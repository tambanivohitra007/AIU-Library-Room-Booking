#!/bin/bash

# Room Booking System - Production Deployment Script
# Run this ON the production server with sudo (as in prod). It cd's to the repo
# root itself, so it works from either location:
#   sudo ./scripts/deploy.sh     (from the repo root)
#   sudo ./deploy.sh             (from inside scripts/)
#   ...add --yes to skip the confirmation prompt
#
# Update the code first. Recommended flow (avoids the git stash dance caused by the
# schema.prisma provider edit - this script re-applies the provider each run):
#   git fetch --all && git reset --hard origin/main
#   sudo ./scripts/deploy.sh
#
# What it does:
#   1. Preflight checks (tools, .env, required secrets)
#   2. Aligns the Prisma provider with DATABASE_URL (sqlite dev / mysql-postgres prod)
#   3. Installs dependencies and builds the server
#   4. Backs up the existing database BEFORE any schema change (never loses prod data)
#   5. Syncs the schema additively with `prisma db push` (adds new columns in place)
#   6. Installs dependencies and builds the client into client/dist
#   7. Hands client/dist to nginx (chown www-data + reload) and (re)starts the API in PM2
#   8. Verifies the API responds and the built client is in place
#
# Matches the production server layout:
#   - MySQL database (name from DATABASE_URL), dumped with mysqldump before schema sync
#   - Node/Express API on PORT (default 5000), run by PM2 as ONE app (apiu-library-api)
#   - React client built to client/dist and served as static files by nginx (no `serve`)
#
# Safe to run over the existing install: schema changes are additive (e.g. the new
# User.language column defaults to "en"), the DB is snapshotted first, and the seed
# script is never invoked.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error()   { echo -e "${RED}ERROR: $1${NC}"; exit 1; }
success() { echo -e "${GREEN}[OK] $1${NC}"; }
info()    { echo -e "${YELLOW}-> $1${NC}"; }
warn()    { echo -e "${YELLOW}WARNING: $1${NC}"; }

AUTO_YES=0
[ "$1" = "--yes" ] && AUTO_YES=1

# System-level steps (chown for www-data, nginx reload, the root-owned PM2 daemon)
# need root. If we're not root but sudo exists, prefix those commands with it.
SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
fi

# Refuse to proceed without a backup unless the operator explicitly accepts (or --yes)
require_backup_ack() {
    [ "$AUTO_YES" = "1" ] && return 0
    read -p "Continue WITHOUT a database backup? (yes/no): " REPLY_ACK
    [ "$REPLY_ACK" = "yes" ] || error "Aborted - back up the database first, then re-run"
}

echo "========================================="
echo " Room Booking - Production Deployment"
echo "========================================="
echo ""

# Work from the project root no matter where this was invoked from (repo root or
# inside scripts/). Resolve the root relative to this script's own location.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.." || error "Could not change to the project root"

# ---------- Preflight ----------

[ -f "package.json" ] && [ -d "server" ] && [ -d "client" ] \
    || error "Project root not found at $SCRIPT_DIR/.. - is deploy.sh still inside <repo>/scripts/?"

command -v node >/dev/null 2>&1 || error "node is not installed"
command -v npm  >/dev/null 2>&1 || error "npm is not installed"
command -v pm2  >/dev/null 2>&1 || error "pm2 is not installed (npm install -g pm2)"
command -v nginx >/dev/null 2>&1 || warn "nginx not found - it serves the built client (client/dist); install/configure it separately"

# ---------- server/.env ----------
# server/.env holds every secret the API reads and is gitignored, so a fresh clone
# (or a stray `git clean -fdx`) leaves the deploy with nothing to read. Rather than
# just failing, walk the operator through creating it. An EXISTING file is never
# read-modified-written here - only created when absent.

# Prompts read from /dev/tty so they still work if stdin is redirected.
ask() {  # ask "question" "default" -> echoes the answer
    local _reply
    if [ -n "$2" ]; then
        read -r -p "  $1 [$2]: " _reply < /dev/tty
        printf '%s' "${_reply:-$2}"
    else
        read -r -p "  $1: " _reply < /dev/tty
        printf '%s' "$_reply"
    fi
}

ask_secret() {  # ask_secret "question" -> echoes the answer, no terminal echo
    local _reply
    read -r -s -p "  $1: " _reply < /dev/tty
    echo > /dev/tty
    printf '%s' "$_reply"
}

# Passwords routinely contain @ : / ? # - all of which break a bare URL
urlencode() { node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"; }

gen_secret() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 48 | tr -d '\n'
    else
        node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64'))"
    fi
}

create_env_file() {
    echo ""
    warn "server/.env is missing - creating it now."
    echo "  Written to server/.env with chmod 600. Nothing leaves this machine."
    echo "  Press Enter to accept the [default] shown."
    echo ""

    echo "  --- Database ---"
    local _db_url
    _db_url="$(ask 'Full DATABASE_URL (leave blank to build a MySQL URL step by step)' '')"
    if [ -z "$_db_url" ]; then
        local _h _p _n _u _pw
        _h="$(ask 'MySQL host' 'localhost')"
        _p="$(ask 'MySQL port' '3306')"
        _n="$(ask 'Database name' 'libbook')"
        _u="$(ask 'Database user' '')"
        _pw="$(ask_secret 'Database password')"
        _db_url="mysql://${_u}:$(urlencode "$_pw")@${_h}:${_p}/${_n}"
    fi

    # Catch a wrong host/user/password NOW - a bad URL here plus `prisma db push`
    # later would write this app's schema into whatever database it does reach.
    if command -v mysql >/dev/null 2>&1; then
        case "$_db_url" in
            mysql://*)
                local _t="${_db_url#mysql://}" _tc _tr _tu _tp _thp _th _tport _tdb
                _tc="${_t%%@*}"; _tr="${_t#*@}"
                _tu="${_tc%%:*}"; _tp="${_tc#*:}"; [ "$_tp" = "$_tc" ] && _tp=""
                _thp="${_tr%%/*}"; _tdb="${_tr#*/}"; _tdb="${_tdb%%\?*}"
                _th="${_thp%%:*}"; _tport="${_thp#*:}"; [ "$_tport" = "$_thp" ] && _tport="3306"
                # The password is URL-encoded in the URL; decode it back for the client
                _tp="$(node -e 'process.stdout.write(decodeURIComponent(process.argv[1]))' "$_tp")"
                if MYSQL_PWD="$_tp" mysql -h "$_th" -P "$_tport" -u "$_tu" \
                        -e "USE \`$_tdb\`; SELECT 1;" >/dev/null 2>&1; then
                    success "Connected to MySQL database '$_tdb' on $_th"
                else
                    warn "Could NOT connect to MySQL database '$_tdb' on $_th with those credentials."
                    warn "Deploying with a wrong DATABASE_URL would push this schema into the wrong database."
                    local _c
                    _c="$(ask 'Continue anyway? (yes/no)' 'no')"
                    [ "$_c" = "yes" ] || error "Aborted - fix the database details and re-run"
                fi
                ;;
        esac
    fi

    echo ""
    echo "  --- Application ---"
    local _client_url _port _admin_emails
    _client_url="$(ask 'CLIENT_URL (public site URL, used for CORS and email links)' 'https://booking.apiu.edu')"
    _port="$(ask 'API port' '5000')"
    _admin_emails="$(ask 'ADMIN_EMAILS (comma-separated; auto-granted SUPERADMIN on first SSO login)' '')"

    echo ""
    echo "  --- Notification sender ---"
    echo "  Notification email is sent through the Microsoft Graph API using the Azure"
    echo "  app below. SMTP_USER is the MAILBOX those messages are sent FROM - it varies"
    echo "  per institution/admin, so set it to the sending account for THIS deployment."
    local _smtp_user
    _smtp_user="$(ask 'SMTP_USER (sender mailbox, e.g. library-noreply@apiu.edu)' '')"

    echo ""
    echo "  --- Microsoft SSO / Graph (paste now, or leave blank and paste later) ---"
    local _tenant _cid _csec _redirect
    _tenant="$(ask 'AZURE_TENANT_ID' '')"
    _cid="$(ask 'AZURE_CLIENT_ID' '')"
    _csec="$(ask_secret 'AZURE_CLIENT_SECRET (hidden; Enter to skip)')"
    _redirect="$(ask 'AZURE_REDIRECT_URI' "${_client_url%/}/auth/callback")"

    local _jwt
    _jwt="$(gen_secret)"

    umask 077
    cat > server/.env <<ENVEOF
# Generated by scripts/deploy.sh on $(date '+%Y-%m-%d %H:%M:%S %Z')
# This file is gitignored and holds live secrets - keep a copy somewhere safe.

# --- Database ---
DATABASE_URL="$_db_url"

# --- Security ---
# Generated with a CSPRNG. Changing it signs every user out (tokens stop verifying).
JWT_SECRET="$_jwt"

# --- Server ---
PORT=$_port
NODE_ENV=production

# --- Client ---
# Used for CORS and for links inside notification emails.
CLIENT_URL="$_client_url"

# Comma-separated; these accounts are granted SUPERADMIN on first SSO sign-in.
ADMIN_EMAILS="$_admin_emails"

# --- Notification sender ---
# The mailbox notifications are sent FROM, via Microsoft Graph (not SMTP auth).
# The Azure app below needs the Mail.Send application permission for this mailbox.
SMTP_USER="$_smtp_user"

# --- Microsoft SSO + Graph ---
AZURE_TENANT_ID="$_tenant"
AZURE_CLIENT_ID="$_cid"
AZURE_CLIENT_SECRET="$_csec"
AZURE_REDIRECT_URI="$_redirect"
ENVEOF
    umask 022

    chmod 600 server/.env
    # The repo is worked on by a normal user; don't leave a root-owned secret behind
    local _owner
    _owner="$(stat -c '%U:%G' . 2>/dev/null || echo '')"
    [ -n "$_owner" ] && chown "$_owner" server/.env 2>/dev/null || true

    success "server/.env created (chmod 600, owner ${_owner:-unchanged})"
    echo ""
    info "Back it up now - it is gitignored, so nothing else on this box has a copy:"
    echo "     sudo cp server/.env ~/aiu-env-backup-$(date +%Y%m%d)"
    echo ""
}

if [ ! -f "server/.env" ]; then
    [ "$AUTO_YES" = "1" ] \
        && error "server/.env not found. Re-run without --yes to create it interactively, or copy server/.env.production.example and fill it in."
    [ -r /dev/tty ] \
        || error "server/.env not found and no terminal is available to create it. Copy server/.env.production.example to server/.env and fill it in."
    create_env_file
fi

# Read a value from server/.env (tolerates spaces around '=' and surrounding quotes)
get_env() {
    grep -E "^[[:space:]]*$1[[:space:]]*=" server/.env | tail -n1 \
        | sed -E "s/^[^=]+=[[:space:]]*//; s/^\"//; s/\"[[:space:]]*$//; s/^'//; s/'[[:space:]]*$//"
}

DATABASE_URL="$(get_env DATABASE_URL)"
JWT_SECRET="$(get_env JWT_SECRET)"
ADMIN_EMAILS="$(get_env ADMIN_EMAILS)"
CLIENT_URL="$(get_env CLIENT_URL)"
PORT="$(get_env PORT)"
PORT="${PORT:-5000}"

[ -n "$DATABASE_URL" ] || error "DATABASE_URL is not set in server/.env"

# The server refuses to start in production without a real JWT_SECRET
[ -n "$JWT_SECRET" ] || error "JWT_SECRET is not set in server/.env - generate one: openssl rand -base64 48"
case "$JWT_SECRET" in
    *change-this*|*dev-only*) error "JWT_SECRET still has a placeholder value - generate a real one" ;;
esac

[ -n "$ADMIN_EMAILS" ] || warn "ADMIN_EMAILS is not set - no account will be auto-granted SUPERADMIN on SSO login"
[ -n "$CLIENT_URL" ]   || warn "CLIENT_URL is not set - email links and CORS will fall back to http://localhost:3000"

# These never abort the deploy - the API runs fine without them - but mail and SSO
# fail silently at runtime, which is far harder to notice than a failed deploy.
SMTP_USER="$(get_env SMTP_USER)"
AZURE_TENANT_ID="$(get_env AZURE_TENANT_ID)"
AZURE_CLIENT_ID="$(get_env AZURE_CLIENT_ID)"
AZURE_CLIENT_SECRET="$(get_env AZURE_CLIENT_SECRET)"
AZURE_REDIRECT_URI="$(get_env AZURE_REDIRECT_URI)"

[ -n "$SMTP_USER" ] || warn "SMTP_USER is not set - no notification email will be sent (it is the Graph sender mailbox)"

MISSING_SSO=""
for _v in AZURE_TENANT_ID AZURE_CLIENT_ID AZURE_CLIENT_SECRET AZURE_REDIRECT_URI; do
    eval "_val=\$$_v"
    [ -n "$_val" ] || MISSING_SSO="$MISSING_SSO $_v"
done
if [ -n "$MISSING_SSO" ]; then
    warn "Microsoft SSO/Graph not fully configured - missing:$MISSING_SSO"
    warn "Sign-in with Microsoft AND all notification email will be unavailable until these are set in server/.env"
fi

case "$DATABASE_URL" in
    file:*) warn "DATABASE_URL points to SQLite - fine for a small deployment, but MySQL/PostgreSQL is recommended" ;;
esac

success "Preflight checks passed"

if [ "$1" != "--yes" ]; then
    read -p "Deploy to production now? (yes/no): " CONFIRM
    [ "$CONFIRM" = "yes" ] || { echo "Deployment cancelled."; exit 0; }
fi

# ---------- Align Prisma provider with DATABASE_URL ----------
# Dev uses SQLite while production uses MySQL/PostgreSQL; Prisma cannot read the
# provider from an env var, so patch schema.prisma to match the URL scheme.

case "$DATABASE_URL" in
    file:*)                    DB_PROVIDER="sqlite" ;;
    mysql://*)                 DB_PROVIDER="mysql" ;;
    postgres://*|postgresql://*) DB_PROVIDER="postgresql" ;;
    *) error "Unrecognized DATABASE_URL scheme: ${DATABASE_URL%%:*}" ;;
esac

CURRENT_PROVIDER=$(grep -E '^\s*provider\s*=\s*"(sqlite|mysql|postgresql)"' server/prisma/schema.prisma \
    | sed -E 's/.*"(sqlite|mysql|postgresql)".*/\1/')

if [ "$CURRENT_PROVIDER" != "$DB_PROVIDER" ]; then
    info "Switching Prisma provider: $CURRENT_PROVIDER -> $DB_PROVIDER"
    sed -i -E "s/provider = \"(sqlite|mysql|postgresql)\"/provider = \"$DB_PROVIDER\"/" server/prisma/schema.prisma
    success "Prisma provider set to $DB_PROVIDER"
else
    success "Prisma provider already matches DATABASE_URL ($DB_PROVIDER)"
fi

# ---------- Build server ----------

echo ""
info "Installing server dependencies..."
cd server
npm ci || npm install
success "Server dependencies installed"

info "Building server (tsc + prisma generate)..."
npm run build
success "Server built"

# ---------- Back up the database (before ANY schema change) ----------
# The existing production data must survive the deploy. Snapshot it now, while the
# schema on disk still matches what created the current DB. (cwd is server/ here.)

echo ""
BACKUP_DIR="../backups"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

case "$DATABASE_URL" in
    file:*)
        # SQLite path is resolved relative to server/prisma/ (schema location)
        DB_FILE="${DATABASE_URL#file:}"
        case "$DB_FILE" in
            /*) DB_PATH="$DB_FILE" ;;               # absolute
            *)  DB_PATH="prisma/${DB_FILE#./}" ;;   # relative to server/prisma
        esac
        if [ -f "$DB_PATH" ]; then
            cp "$DB_PATH" "$BACKUP_DIR/backup-$STAMP.db"
            success "SQLite database backed up to backups/backup-$STAMP.db"
        else
            warn "No SQLite file at $DB_PATH - treating as a fresh database (nothing to back up)"
        fi
        ;;
    postgres://*|postgresql://*)
        if command -v pg_dump >/dev/null 2>&1; then
            if pg_dump "$DATABASE_URL" > "$BACKUP_DIR/backup-$STAMP.sql"; then
                success "PostgreSQL database dumped to backups/backup-$STAMP.sql"
            else
                error "pg_dump failed - aborting before the schema change (data left untouched)"
            fi
        else
            warn "pg_dump not found - cannot auto-back up this PostgreSQL database"
            require_backup_ack
        fi
        ;;
    mysql://*)
        if command -v mysqldump >/dev/null 2>&1; then
            # Parse mysql://user:pass@host:port/db?params
            _u="${DATABASE_URL#mysql://}"
            _creds="${_u%%@*}"; _rest="${_u#*@}"
            _user="${_creds%%:*}"
            _pass="${_creds#*:}"; [ "$_pass" = "$_creds" ] && _pass=""
            _hostport="${_rest%%/*}"; _dbpart="${_rest#*/}"
            _host="${_hostport%%:*}"
            _port="${_hostport#*:}"; [ "$_port" = "$_hostport" ] && _port="3306"
            _db="${_dbpart%%\?*}"
            # --single-transaction: consistent snapshot without locking (InnoDB)
            # --no-tablespaces: avoids the PROCESS privilege the app DB user lacks
            if MYSQL_PWD="$_pass" mysqldump --single-transaction --no-tablespaces \
                    -h "$_host" -P "$_port" -u "$_user" "$_db" > "$BACKUP_DIR/backup-$STAMP.sql"; then
                success "MySQL database dumped to backups/backup-$STAMP.sql"
            else
                warn "mysqldump failed (check host/credentials) - could not auto-back up"
                require_backup_ack
            fi
        else
            warn "mysqldump not found - cannot auto-back up this MySQL database"
            require_backup_ack
        fi
        ;;
esac

# ---------- Database schema ----------
# This project keeps the schema in schema.prisma and syncs with `db push` (no
# committed migrations - see CLAUDE.md). db push issues the additive ALTER (e.g.
# adds User.language) and, without --accept-data-loss, ABORTS rather than dropping
# data - so existing rows are kept and current users default to language "en".
#
# The old server hit Prisma P3018 / MySQL 1064 (`... near '"User" ('`) because
# migrations generated for SQLite use double-quoted identifiers MySQL rejects.
# db push sidesteps that. Only set USE_MIGRATIONS=1 if you keep committed
# migrations regenerated for THIS provider.

echo ""
if [ "${USE_MIGRATIONS:-0}" = "1" ]; then
    LOCK="prisma/migrations/migration_lock.toml"
    [ -f "$LOCK" ] || error "USE_MIGRATIONS=1 but $LOCK is missing - generate migrations first, or unset it to use db push"
    LOCK_PROVIDER=$(sed -nE 's/.*provider *= *"([a-z]+)".*/\1/p' "$LOCK")
    [ "$LOCK_PROVIDER" = "$DB_PROVIDER" ] \
        || error "migrations were generated for '$LOCK_PROVIDER' but DATABASE_URL is '$DB_PROVIDER' - the SQLite-migrations-on-MySQL trap (error 1064). Regenerate them for $DB_PROVIDER or unset USE_MIGRATIONS."
    info "Applying committed migrations (prisma migrate deploy)..."
    npx prisma migrate deploy
    success "Migrations applied"
else
    info "Syncing schema additively with 'prisma db push'..."
    npx prisma db push --skip-generate
    success "Database schema synced (no data dropped)"
fi
# Note: seeding is intentionally NOT run - the seed script wipes all data
# and refuses to run when NODE_ENV=production anyway.

# ---------- Build client ----------

echo ""
info "Installing client dependencies..."
cd ../client
npm ci || npm install
success "Client dependencies installed"

info "Building client into client/dist..."
npm run build
success "Client built"

# nginx serves client/dist as static files, so it must be able to read them.
if id www-data >/dev/null 2>&1; then
    $SUDO chown -R www-data:www-data dist \
        && success "client/dist owned by www-data (nginx can read it)" \
        || warn "Could not chown client/dist to www-data - nginx may return 403"
fi
if command -v nginx >/dev/null 2>&1; then
    if $SUDO nginx -t >/dev/null 2>&1; then
        $SUDO systemctl reload nginx && success "nginx reloaded" || warn "nginx reload failed - reload it manually"
    else
        warn "nginx config test failed - not reloading. Check: $SUDO nginx -t"
    fi
fi

# ---------- Start / reload the API in PM2 ----------
# ONE PM2 app runs the API from server/dist/index.js. The client is NOT a PM2 app
# (nginx serves it). Reuse whatever API app name is already registered so a re-deploy
# reloads it in place instead of starting a second process on the same port.

echo ""
info "Starting or reloading the API in PM2..."
cd ../server
mkdir -p logs

APP_NAME="${PM2_APP_NAME:-}"
if [ -z "$APP_NAME" ]; then
    for candidate in apiu-library-api aiu-library-api; do
        if $SUDO pm2 describe "$candidate" >/dev/null 2>&1; then APP_NAME="$candidate"; break; fi
    done
fi

# Always (re)start through the ecosystem file: `pm2 restart <name> --update-env` refreshes
# the env from the calling shell only, so settings declared in the config (e.g. TZ) would
# never reach a long-running app. Passing the file is what re-reads them.
CONFIG_APP_NAME="aiu-library-api"
if [ -n "$APP_NAME" ] && [ "$APP_NAME" != "$CONFIG_APP_NAME" ] && $SUDO pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    info "Removing legacy PM2 app '$APP_NAME' (config declares '$CONFIG_APP_NAME')"
    # Without this the next line would start a SECOND process on the same port.
    $SUDO pm2 delete "$APP_NAME" || true
fi
info "Starting/reloading the API from ecosystem.config.cjs (name: $CONFIG_APP_NAME)"
$SUDO pm2 startOrRestart ecosystem.config.cjs --update-env
APP_NAME="$CONFIG_APP_NAME"
$SUDO pm2 save
cd ..
success "API running under PM2 as '$APP_NAME' (process list saved)"

# ---------- Verify ----------

echo ""
info "Verifying the API responds on port $PORT..."
API_OK=""
for i in $(seq 1 15); do
    if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
        API_OK="yes"
        break
    fi
    sleep 1
done
[ -n "$API_OK" ] && success "API is healthy" || error "API did not respond on port $PORT within 15s - check: $SUDO pm2 logs $APP_NAME"

info "Verifying the built client is in place..."
if [ -f "client/dist/index.html" ]; then
    success "client/dist/index.html present (served by nginx)"
else
    warn "client/dist/index.html not found - the client build may have failed"
fi

echo ""
echo "========================================="
echo -e "${GREEN} Deployment complete${NC}"
echo "========================================="
echo ""
echo "Post-deploy checklist:"
echo "  - $SUDO pm2 status                    # the API app is online"
echo "  - Open https://booking.apiu.edu and hard-refresh (Ctrl+Shift+R) to pick up new assets"
echo "  - Sign in and check Admin -> Settings (branding, hours, domains)"
echo "  - Create/activate a Semester that covers today, or bookings will be rejected"
echo "  - nginx serves client/dist and proxies /api -> 127.0.0.1:$PORT (verify: $SUDO nginx -t)"
echo "  - First time only: '$SUDO pm2 startup' so the API restarts on reboot"
echo "  - DB dump saved under ./backups/ (keep the cron backup at /usr/local/bin/aiu-mysql-backup.sh too)"
echo ""
