# Room Booking System

A production-ready, white-label room booking application with a React + TypeScript frontend and a Node.js + Express + Prisma backend. Originally built for a university library, it is now fully configurable — branding, email domains, operating hours, departments, and booking policies are all data, not code — so any organization can deploy it for study rooms, labs, meeting rooms, or courts.

## Highlights

- **Outlook-style calendar UI** — left sidebar with mini calendar and a searchable, department-grouped room list; day/week/month views; drag-to-select booking; "New Booking" finds the next free slot automatically
- **Departments** — group rooms by department, each with its own operating hours, contact emails, and appointed managers who approve/cancel bookings for their rooms only
- **Booking policies per room** — capacity ranges, terms & conditions with recorded acceptance, and an optional approval workflow (requests hold the slot as *Pending* until a manager approves)
- **Microsoft SSO** (Azure AD) plus local accounts, with a configurable email-domain allowlist and a self-registration toggle
- **Role hierarchy** — SUPERADMIN → ADMIN → STUDENT_WORKER → STUDENT, plus per-department managers assignable to any user
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
│   └── ecosystem.config.cjs      # PM2 config (serves dist/ on port 3000)
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

| Capability | STUDENT | STUDENT_WORKER | Dept. Manager* | ADMIN | SUPERADMIN |
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

\* Department manager is an assignment (Admin → Departments), independent of role — a STUDENT can manage a department. All checks are enforced server-side.

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

Deploy everything with one script, run **on the production server** from the project root:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh          # interactive (asks for confirmation)
./scripts/deploy.sh --yes    # non-interactive (CI / unattended)
```

The script performs, in order:

1. **Preflight checks** — verifies `node`, `npm`, `pm2` (and warns if `serve` is missing, which the web app needs), confirms `server/.env` exists, and validates its values. It **hard-fails if `JWT_SECRET` is missing or still a placeholder** — the server itself refuses to start in production without a real one.
2. **Prisma provider alignment** — reads the `DATABASE_URL` scheme and automatically patches `schema.prisma` to `sqlite` / `mysql` / `postgresql`. You never edit the provider by hand; dev stays on SQLite while production uses MySQL/PostgreSQL.
3. **Builds** — `npm ci` + TypeScript build for the server (includes `prisma generate`), then the client production build.
4. **Database sync** — runs `prisma migrate deploy` when a migrations folder exists, otherwise `prisma db push`. Seeding is never run: the seed script wipes all data and independently refuses to run when `NODE_ENV=production`.
5. **PM2** — starts or reloads both apps (`aiu-library-api` on port 5000, `aiu-library-web` serving the client on port 3000) and runs `pm2 save`.
6. **Verification** — polls `GET /api/health` for up to 15 seconds and checks that the web app responds, then prints a post-deploy checklist.

### Server Prerequisites (one-time)

```bash
npm install -g pm2 serve
pm2 startup     # so the apps restart after a reboot
```

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
6. Point your reverse proxy (nginx + SSL) at port 3000 (web) and port 5000 (API)
7. Set up database backups and monitoring (see docs/DEPLOYMENT_GUIDE.md)

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

- **User** — role (`STUDENT | STUDENT_WORKER | ADMIN | SUPERADMIN`), status (`PENDING | ACTIVE | SUSPENDED`), provider (`LOCAL | MICROSOFT`)
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

## Handling Updates

```bash
git pull origin main
```

**Development:**
```bash
cd server && npm install && npx prisma db push && npm run prisma:generate
cd ../client && npm install
```

**Production:**
```bash
# One command does it all: deps, builds, schema sync, PM2 reload, health check
./scripts/deploy.sh --yes
```

## Monitoring & Logs

- Winston logs in `server/logs/` (`error.log`, `combined.log`)
- Background scheduler (every 5 min): completes past bookings, expires unapproved pending requests, sends reminder emails

```bash
pm2 status
pm2 logs aiu-library-api      # API logs
pm2 logs aiu-library-web      # web server logs
pm2 monit                     # live resource view
pm2 restart aiu-library-api
```

## Troubleshooting

- **"Bookings are only allowed within the current semester"** — no active semester covers today; create one in Admin → Semesters
- **"Self-registration is disabled"** — expected default; enable it in Admin → Settings or use Microsoft SSO / admin-created accounts
- **Server exits on start in production** — `JWT_SECRET` is missing from `server/.env`
- **No approval emails arriving** — check Azure credentials and that the app registration has the `Mail.Send` application permission; the department needs managers or contact emails assigned
- **CORS errors** — `CLIENT_URL` in `server/.env` must match the URL the client is served from
- **Port already in use** — `lsof -ti:5000 | xargs kill -9` (Linux/Mac) or `netstat -ano | findstr :5000` + `taskkill /PID <pid> /F` (Windows)
- **TypeScript check** — `cd server && npx tsc --noEmit` / `cd client && npx tsc --noEmit`

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
