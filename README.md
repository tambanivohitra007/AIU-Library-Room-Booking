# Room Booking System

A production-ready, white-label room booking application with a React + TypeScript frontend and a Node.js + Express + Prisma backend. Originally built for a university library, it is now fully configurable — branding, email domains, operating hours, departments, and booking policies are all data, not code — so any organization can deploy it for study rooms, labs, meeting rooms, or courts.

## Highlights

- **Outlook-style calendar UI** — left sidebar with mini calendar and a searchable, department-grouped room list; day/week/month views; drag-to-select booking; "New Booking" finds the next free slot automatically
- **Departments** — group rooms by department, each with its own operating hours, contact emails, and appointed managers who approve/cancel bookings for their rooms only
- **Booking policies per room** — capacity ranges, terms & conditions with recorded acceptance, and an optional approval workflow (requests hold the slot as *Pending* until a manager approves)
- **Microsoft SSO** (Azure AD) plus local accounts, with a configurable email-domain allowlist and a self-registration toggle
- **Role hierarchy** — SUPERADMIN → ADMIN → STUDENT_WORKER → FACULTY / STUDENT, plus per-department managers assignable to any user
- **Email notifications** via Microsoft Graph — approval requests, approvals, rejections, cancellations, and automatic reminders
- **Server-enforced rules** — operating hours, semester windows, capacities, terms, approvals, and permissions are all validated by the API, never just the UI

## Features

### For Users
- Interactive calendar with drag-to-select booking (15-minute granularity)
- Room details view: capacity, features, effective operating hours, terms & conditions
- Room search across name, description, features, and department
- My Bookings page with status tracking (Pending / Confirmed / Cancelled / Completed) and self-cancellation
- Closed hours and other users' bookings are visually blocked on the timeline

### For Department Managers
Any user can be appointed manager of one or more departments (Admin → Departments). Managers can — for **their departments only**:
- Edit the department (name, contact emails, custom operating hours)
- Create, edit, and delete its rooms (including terms and approval settings)
- See full booking details, approve/reject pending requests, cancel bookings, send reminders
- Receive "booking awaiting approval" emails automatically

### For Admins
- Dashboard with statistics and room utilization
- User management: create, edit, approve, suspend, delete; bulk CSV import
- Room and department management across the whole system
- Booking management with filters, striped tables, CSV/PDF export
- Semester management (bookings are only allowed within the active semester)

### For Superadmins
Everything admins can do, plus exclusively:
- **Service Settings**: branding (name, logo, description), contact emails, allowed email domains, self-registration toggle, global operating hours
- Granting/revoking privileged roles and managing admin accounts

### Security
- JWT authentication; secret is **required** in production (server refuses to start without it)
- Live permission checks on every request — suspensions and demotions take effect immediately, not at token expiry
- Rate limiting, Helmet headers, CORS allowlist, express-validator input validation
- bcrypt password hashing; Prisma ORM (no raw SQL)
- Privileged-account management restricted to superadmins
- Seed script refuses to run when `NODE_ENV=production`

## Architecture

```
├── client/                       # React + Vite frontend
│   ├── components/               # UI components (Timeline, AdminDashboard, modals, ...)
│   ├── contexts/                 # SettingsContext (branding/hours), ToastContext
│   ├── pages/                    # HomePage (calendar), MyBookingsPage, AdminPage, AuthCallbackPage
│   ├── utils/                    # operatingHours helpers (parse, effective hours, closed ranges)
│   ├── services/api.ts           # All HTTP calls; JWT in localStorage
│   └── ecosystem.config.cjs      # legacy PM2 config; deploy.sh serves dist/ via nginx instead
├── server/                       # Node.js + Express API
│   ├── src/
│   │   ├── routes/               # auth, users, rooms, bookings, departments, semesters, admin, settings
│   │   ├── middleware/           # authenticateToken (live role check), requireAdmin/SuperAdmin, validation, rate limits
│   │   ├── services/             # settings (hours/domains), permissions (dept scoping), email (Graph), bookingScheduler
│   │   ├── controllers/          # settingsController
│   │   └── index.ts              # Server entry
│   ├── prisma/                   # schema.prisma, seed.ts
│   └── ecosystem.config.cjs      # PM2 config (API on port 5000)
├── scripts/
│   ├── deploy.sh                 # Full automated production deployment (see below)
│   └── production-check.sh       # Pre-deploy readiness check
└── docs/                         # Deployment guide, production checklists
```

Data flow: the client polls the API every 5 seconds; state lives in `App.tsx` and flows down as props. Branding and operating hours come from `SettingsContext`, loaded from the public `GET /api/settings`.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS (flat design, Outlook-inspired)
- **Backend**: Node.js, Express, Prisma ORM, JWT, Winston, express-rate-limit, Helmet
- **Database**: SQLite (development) / MySQL or PostgreSQL (production) — provider switched automatically at deploy time
- **Auth**: Local accounts + Microsoft SSO (Azure AD); emails via Microsoft Graph API
- **Process management**: PM2

## Getting Started (Development)

### Prerequisites
- Node.js v18+
- npm

### Setup

```bash
git clone <repository-url>
cd <project-folder>

# Server
cd server
npm install
cp .env.example .env        # then edit (see below)
npm run prisma:generate
npx prisma db push          # create/update the SQLite dev database
npm run prisma:seed         # dev users + sample rooms/department

# Client
cd ../client
npm install
```

### Development environment (`server/.env`)

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="<any long random string>"
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
ADMIN_EMAILS=you@example.edu          # auto-granted SUPERADMIN on Microsoft SSO login

# Optional in dev — needed for Microsoft SSO and email notifications
AZURE_CLIENT_ID=...
AZURE_TENANT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_REDIRECT_URI=http://localhost:3000/auth/callback
SMTP_USER=notifications@example.edu
```

### Run

```bash
# Terminal 1
cd server && npm run dev     # http://localhost:5000

# Terminal 2
cd client && npm run dev     # http://localhost:3000
```

### Default users (seed, development only)
- **Superadmin**: `bob@uni.edu` / `admin123`
- **Student**: `alice@uni.edu` / `student123`

> Bookings are only accepted inside the **active semester** — create one under Admin → Semesters before testing the booking flow.

## Roles & Permissions

| Capability | STUDENT / FACULTY | STUDENT_WORKER | Dept. Manager* | ADMIN | SUPERADMIN |
|---|---|---|---|---|---|
| Book rooms, manage own bookings | ✅ | ✅ | ✅ | ✅ | ✅ |
| See all booking details / cancel / remind | — | ✅ | own depts | ✅ | ✅ |
| Approve / reject pending bookings | — | ✅ | own depts | ✅ | ✅ |
| Manage rooms | — | — | own depts | ✅ | ✅ |
| Manage departments | — | — | own (edit only) | ✅ | ✅ |
| Assign department managers | — | — | — | ✅ | ✅ |
| Manage users, semesters | — | view users | — | ✅ | ✅ |
| Change roles / manage admin accounts | — | — | — | — | ✅ |
| Service Settings (branding, domains, hours) | — | — | — | — | ✅ |

\* Department manager is an assignment (Admin → Departments), independent of role. **It grants scope, it does not remove any** — a user whose role is ADMIN keeps global powers over every department regardless of the assignment. To confine someone to their own department, set their role to **FACULTY** (or STUDENT) *and* add them to that department's managers. `FACULTY` and `STUDENT` have identical permissions; `FACULTY` exists so a department head is not labelled a student. All checks are enforced server-side.

## Booking Rules

A booking request must pass **all** of these server-side checks:

1. **Future time**, start before end, within a single day
2. **Operating hours** — the room's department schedule if set, otherwise the global schedule from Settings (per-weekday open/close or closed)
3. **Active semester** — start and end must fall within it
4. **No overlap** with confirmed *or pending* bookings (pending requests hold their slot)
5. **Capacity** — attendee count (including the booker) within the room's min–max
6. **Terms & conditions** — if the room has terms, acceptance is required and the timestamp is stored (`termsAcceptedAt`)
7. **Approval** — rooms marked *requires approval* create the booking as `PENDING`; department managers and staff approve or reject (with a reason emailed to the booker). Requests still pending when their start time passes are auto-cancelled by the scheduler.

## Production Deployment

> **📖 Complete Guide**: See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for server setup, SSL, monitoring, and troubleshooting.

### Quick Start (automated)

Deploy everything with one script, run **on the production server** from the project root
(update the code first — see [Updating to the Latest Version](#updating-to-the-latest-version)):

```bash
chmod +x scripts/deploy.sh
sudo ./scripts/deploy.sh          # interactive (asks for confirmation)
sudo ./scripts/deploy.sh --yes    # non-interactive (CI / unattended)
```

The script performs, in order:

1. **Preflight checks** — verifies `node`, `npm`, `pm2` (and warns if `nginx` is missing, which serves the built client). If `server/.env` is absent it offers to build it interactively; otherwise it validates the values. It **hard-fails if `JWT_SECRET` is missing or still a placeholder** — the server itself refuses to start in production without a real one — and warns when `SMTP_USER` or any `AZURE_*` value is empty, since mail and SSO then fail silently at runtime.
2. **Prisma provider alignment** — reads the `DATABASE_URL` scheme and automatically patches `schema.prisma` to `sqlite` / `mysql` / `postgresql`. You never edit the provider by hand; dev stays on SQLite while production uses MySQL/PostgreSQL.
3. **Builds** — `npm ci` + TypeScript build for the server (includes `prisma generate`), then the client production build.
4. **Database backup** — dumps the current database to `./backups/` *before* any schema change (`mysqldump` / `pg_dump` / file copy for SQLite). A failed dump requires explicit confirmation to continue.
5. **Database sync** — `prisma db push`, which applies additive changes and aborts rather than dropping data. Committed migrations are used instead only when `USE_MIGRATIONS=1`. Seeding is never run: the seed script wipes all data and independently refuses to run when `NODE_ENV=production`.
6. **Serve + PM2** — hands `client/dist` to nginx (`chown www-data`, config test, reload) and starts or reloads the single API app `aiu-library-api` from `server/ecosystem.config.cjs`, then runs `pm2 save`. The client is **not** a PM2 app.
7. **Verification** — polls `GET /api/health` for up to 15 seconds, confirms `client/dist/index.html` is in place, then prints a post-deploy checklist.

### Server Prerequisites (one-time)

```bash
npm install -g pm2
sudo apt install nginx          # serves the built client from client/dist
pm2 startup                     # so the API restarts after a reboot
sudo timedatectl set-timezone Asia/Bangkok   # match your institution's wall clock
```

> **Timezone matters.** Operating-hours checks, the booking scheduler, and email timestamps all
> use the server's local time. `server/ecosystem.config.cjs` pins `TZ`, but setting it on the host
> too keeps log timestamps and cron backups consistent, and survives a host rebuild.

### Environment (`server/.env`)

```env
DATABASE_URL="mysql://user:pass@host:3306/room_booking"  # provider is auto-derived from this
JWT_SECRET="<generate: openssl rand -base64 48>"         # REQUIRED - server won't boot without it
NODE_ENV=production
PORT=5000
CLIENT_URL="https://booking.example.edu"                 # used for CORS and links in emails
ADMIN_EMAILS=you@example.edu                             # auto-granted SUPERADMIN on Microsoft SSO login

# Microsoft SSO + email notifications (Graph API)
AZURE_CLIENT_ID=...
AZURE_TENANT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_REDIRECT_URI="https://booking.example.edu/auth/callback"  # must match the Azure app registration
SMTP_USER=notifications@example.edu                      # mailbox notifications are sent as
```

### Post-Deploy Checklist

1. `pm2 status` — both apps online
2. Sign in with Microsoft using an `ADMIN_EMAILS` address — you'll be SUPERADMIN
3. **Admin → Settings**: service name/logo, contact emails, allowed email domains, global operating hours, self-registration on/off
4. **Admin → Semesters**: create and activate a semester covering today — **bookings are rejected outside the active semester**
5. **Admin → Departments**: create departments, set their hours/contacts, assign rooms and managers
6. nginx serves `client/dist` as static files and proxies `/api` → `127.0.0.1:5000` (verify with `sudo nginx -t`)
7. Hard-refresh the browser (Ctrl+Shift+R) — the client bundle is content-hashed, and a stale cache hides the new build
8. Back up `server/.env` off the server, and set up database backups and monitoring (see docs/DEPLOYMENT_GUIDE.md)

## API Overview

All routes are prefixed with `/api`. Authenticated routes expect `Authorization: Bearer <JWT>`.

### Auth
- `POST /auth/login` — local login
- `POST /auth/register` — self-registration (403 unless enabled in Settings; new accounts await admin approval)
- `GET /auth/microsoft/url`, `POST /auth/microsoft/login` — Microsoft SSO flow
- `GET /auth/me` — current user (includes `managedDepartmentIds`)
- `POST /auth/change-password`

### Bookings
- `GET /bookings` — all bookings (details masked unless owner/staff/manager)
- `POST /bookings` — create (runs every rule in *Booking Rules* above)
- `POST /bookings/check-conflicts` — live conflict check
- `POST /bookings/:id/approve` / `POST /bookings/:id/reject` — staff or the room's department managers
- `POST /bookings/:id/remind` — manual reminder email
- `DELETE /bookings/:id` — cancel / withdraw (owner, staff, or department manager)

### Rooms & Departments
- `GET /rooms`, `GET /rooms/:id` — public; includes department
- `POST|PUT|DELETE /rooms/:id` — admin, or department manager within their departments
- `GET /departments` — public list with room counts
- `POST|DELETE /departments/:id` — admin only
- `PUT /departments/:id` — admin or that department's manager; `adminUserIds` (manager list) applied for admins only
- `GET /departments/:id/admins` — admin only

### Users (admin) & Settings
- `GET /users` — admin/worker; `POST|PUT|DELETE /users/:id`, `POST /users/import` — admin (privileged targets/roles require superadmin)
- `PATCH /admin/users/:id/role` — superadmin only
- `GET /settings` — public (branding, hours, flags for the login page)
- `PUT /settings` — superadmin only
- `GET|POST|PUT|DELETE /semesters` — read for staff, write for admins

## Database Schema (key points)

- **User** — role (`STUDENT | FACULTY | STUDENT_WORKER | ADMIN | SUPERADMIN`; `FACULTY` is `STUDENT` with a different label), status (`PENDING | ACTIVE | SUSPENDED`), provider (`LOCAL | MICROSOFT`)
- **Department** — name, `contactEmail` (comma-separated list), `operatingHours` (JSON weekly schedule; null = inherit global)
- **DepartmentAdmin** — join table granting a user management rights over one department
- **Room** — capacity range, `features` (JSON string array), `bookingTerms` (null = no acceptance step), `requiresApproval`, optional `departmentId` (SetNull on department delete)
- **Booking** — status `PENDING | CONFIRMED | CANCELLED | COMPLETED`, `cancellationReason`, `termsAcceptedAt`, `reminderSent`; attendees cascade-delete
- **Semester** — start/end window; exactly one active at a time; bookings must fall inside it
- **ServiceSettings** — singleton row: branding, `contactEmail` (list), `allowedEmailDomains` (empty = any), `operatingHours` (global weekly schedule), `allowSelfRegistration` (default off)

Weekly schedules are stored as a JSON array of 7 entries (Sun–Sat), each `{ "open": 8, "close": 22 }` or `null` for closed. Parsing helpers live in `server/src/services/settings.ts` and `client/utils/operatingHours.ts`.

## Switching Database Providers

> **Note**: In production, `scripts/deploy.sh` sets the Prisma provider automatically from the `DATABASE_URL` scheme — the manual steps below are only needed when switching your local development database.

1. Change `provider` in `server/prisma/schema.prisma` (`sqlite` / `mysql` / `postgresql`)
2. Update `DATABASE_URL` in `server/.env`
3. Delete `server/prisma/migrations/` if switching between engines (migrations are engine-specific)
4. `npx prisma db push` (dev) to create the tables, then optionally `npm run prisma:seed`

## Updating to the Latest Version

### See what's new first (optional)

```bash
git fetch --all
git log --oneline HEAD..origin/main     # commits you don't have yet
git diff --stat HEAD origin/main        # files they touch
```

### Production

```bash
cd /path/to/AIU-Library-Room-Booking
git fetch --all
git reset --hard origin/main            # NOT git pull - see below
sudo ./scripts/deploy.sh                # deps, build, DB backup + schema sync, PM2 reload, health check
```

> **Use `reset --hard`, not `git pull`.** `deploy.sh` rewrites the `provider` line in
> `server/prisma/schema.prisma` on every run to match your `DATABASE_URL`, so the production
> working tree is *always* modified and `git pull` will refuse or leave you resolving a
> conflict. `reset --hard` discards that one local edit; the next deploy re-applies it.

> **Never run `git clean -fdx` here.** `server/.env` is gitignored, so it is not in the
> repository and nothing else on the server has a copy — cleaning untracked files destroys
> your `JWT_SECRET` (unrecoverable; every user is signed out) and `DATABASE_URL`.
> `git reset --hard` alone does *not* touch it. Keep a backup:
> `sudo cp server/.env ~/aiu-env-backup-$(date +%F)`

If `server/.env` is missing, `deploy.sh` walks you through recreating it interactively
(database, URLs, notification sender, Microsoft SSO) and generates a fresh `JWT_SECRET`.

### Development

```bash
git pull origin main                    # fine here - no provider rewriting locally

cd server
npm install
npx prisma db push                      # apply any new columns to dev.db
npm run prisma:generate                 # regenerate the Prisma client after schema changes
cd ../client && npm install
```

Restart both dev servers afterwards. If `prisma generate` fails with `EPERM` on Windows, the
running dev server is holding the query-engine DLL — stop it, regenerate, then start it again.

### Rolling back

```bash
git log --oneline -10                   # find the commit that was live before
git reset --hard <commit-sha>
sudo ./scripts/deploy.sh
```

Schema changes are additive (`prisma db push` never drops columns without
`--accept-data-loss`), so rolling the code back is safe. Every deploy also writes a database
dump to `./backups/` beforehand.

## Monitoring & Logs

- Winston logs in `server/logs/` (`error.log`, `combined.log`)
- Background scheduler (every 5 min): completes past bookings, expires unapproved pending requests, sends reminder emails

```bash
pm2 status
pm2 logs aiu-library-api      # API logs (the client is served by nginx, not PM2)
pm2 monit                     # live resource view
pm2 restart aiu-library-api
sudo tail -f /var/log/nginx/error.log   # client / static-file issues
```

The **Admin → Audit** tab records who approved, rejected, or cancelled each booking, plus
room, department, closure, semester, user, and settings changes. Global admins see everything;
department managers see only their own departments. It is append-only — there is no way to
edit or delete entries through the app.

## Troubleshooting

- **"Bookings are only allowed within the current semester"** — no active semester covers today; create one in Admin → Semesters
- **"Self-registration is disabled"** — expected default; enable it in Admin → Settings or use Microsoft SSO / admin-created accounts
- **Server exits on start in production** — `JWT_SECRET` is missing from `server/.env`
- **No approval emails arriving** — check Azure credentials and that the app registration has the `Mail.Send` application permission; the department needs managers or contact emails assigned
- **CORS errors** — `CLIENT_URL` in `server/.env` must match the URL the client is served from
- **Port already in use** — `lsof -ti:5000 | xargs kill -9` (Linux/Mac) or `netstat -ano | findstr :5000` + `taskkill /PID <pid> /F` (Windows)
- **TypeScript check** — `cd server && npx tsc --noEmit` / `cd client && npx tsc --noEmit`
- **`git fetch` fails with "insufficient permission for adding an object"** — a previous `sudo git`/`sudo npm` left root-owned files. Fix with `sudo chown -R <user>:<user> /path/to/repo`; do **not** work around it with `sudo git`, which digs the hole deeper
- **`ERROR: server/.env not found`** — recreate it by running `sudo ./scripts/deploy.sh` without `--yes` and answering the prompts; restore `DATABASE_URL` from your backup script rather than guessing
- **Bookings rejected during opening hours** (e.g. "only available between 8:00 and 22:00" for an 8am slot) — the server is running in the wrong timezone. Check with `sudo pm2 exec aiu-library-api -- node -e "console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)"`; it must print your institution's zone, not `UTC`
- **PM2 env changes not taking effect** — `pm2 restart <name> --update-env` re-reads the *calling shell*, not `ecosystem.config.cjs`. Pass the file (`pm2 startOrRestart ecosystem.config.cjs --update-env`), which is what `deploy.sh` does

## Documentation

- **README.md** — this file: overview, setup, deployment
- **[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** — server setup, SSL, backups, troubleshooting
- **[docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md)** — pre/post deployment checklist
- **CLAUDE.md** — codebase conventions and commands for AI-assisted development

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Open a Pull Request

## License

MIT

## Version History

- **v2.0.0** (2026-07) — White-label release
  - Generic, configurable branding; allowed email domains; self-registration toggle
  - Departments with scoped managers, per-department operating hours and contacts
  - Booking approval workflow (pending → approve/reject) with email notifications
  - Per-room terms & conditions with acceptance audit; server-enforced capacity and hours
  - SUPERADMIN role; hardened auth (live role checks, production JWT enforcement)
  - Outlook-style calendar UI with flat design; automated one-command deployment
- **v1.0.0** (2026-01) — Initial production release for the AIU Library
