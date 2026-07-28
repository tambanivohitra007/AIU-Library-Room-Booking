#!/bin/bash

# Room Booking System - Production Deployment Script
# Run this ON the production server, from the project root:
#   ./scripts/deploy.sh          (interactive)
#   ./scripts/deploy.sh --yes    (no confirmation prompt)
#
# What it does:
#   1. Preflight checks (tools, .env, required secrets)
#   2. Aligns the Prisma provider with DATABASE_URL (sqlite dev / mysql-postgres prod)
#   3. Installs dependencies and builds the server
#   4. Backs up the existing database BEFORE any schema change (never loses prod data)
#   5. Syncs the schema additively (migrate deploy if migrations exist, else db push)
#   6. Installs dependencies and builds the client
#   7. Starts or reloads both PM2 apps and saves the process list
#   8. Verifies the API and web app respond
#
# Safe to run over an existing install: schema changes are additive (e.g. the new
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

# ---------- Preflight ----------

[ -f "package.json" ] && [ -d "server" ] && [ -d "client" ] \
    || error "Run this script from the project root directory"

command -v node >/dev/null 2>&1 || error "node is not installed"
command -v npm  >/dev/null 2>&1 || error "npm is not installed"
command -v pm2  >/dev/null 2>&1 || error "pm2 is not installed (npm install -g pm2)"
command -v serve >/dev/null 2>&1 || warn "'serve' not found globally (npm install -g serve) - the web app needs it"

[ -f "server/.env" ] || error "server/.env not found - create it before deploying"

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
            if MYSQL_PWD="$_pass" mysqldump -h "$_host" -P "$_port" -u "$_user" "$_db" > "$BACKUP_DIR/backup-$STAMP.sql"; then
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

echo ""
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    info "Applying database migrations (prisma migrate deploy)..."
    npx prisma migrate deploy
    success "Migrations applied"
else
    # db push applies additive changes (new tables/columns) in place. Without
    # --accept-data-loss it ABORTS instead of dropping data, so existing rows are
    # safe; the new User.language column defaults to "en" for current users.
    info "No migrations folder - syncing schema additively with 'prisma db push'"
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

info "Building client..."
npm run build
success "Client built"

# ---------- Start / reload PM2 apps ----------

echo ""
info "Starting or reloading PM2 apps..."
cd ../server
pm2 startOrRestart ecosystem.config.cjs --update-env
cd ../client
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
cd ..
success "PM2 apps running (list saved for restart-on-boot)"

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
[ -n "$API_OK" ] && success "API is healthy" || error "API did not respond on port $PORT within 15s - check: pm2 logs aiu-library-api"

info "Verifying the web app responds on port 3000..."
if curl -fsS "http://localhost:3000" >/dev/null 2>&1; then
    success "Web app is up"
else
    warn "Web app did not respond on port 3000 - check: pm2 logs aiu-library-web (is 'serve' installed?)"
fi

echo ""
echo "========================================="
echo -e "${GREEN} Deployment complete${NC}"
echo "========================================="
echo ""
echo "Post-deploy checklist:"
echo "  - pm2 status                        # both apps online"
echo "  - Sign in and check Admin -> Settings (branding, hours, domains)"
echo "  - Create/activate a Semester that covers today, or bookings will be rejected"
echo "  - Ensure your reverse proxy (nginx/IIS) forwards to ports 3000 (web) and $PORT (api)"
echo ""
