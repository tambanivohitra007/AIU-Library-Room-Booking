# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AIU Library Room Booking System — a full-stack monorepo for Adventist International University. React + TypeScript frontend (`client/`) and Node.js + Express + Prisma backend (`server/`).

## Development Commands

### Server (run from `server/`)
```bash
npm run dev              # Start with tsx watch (hot reload) on port 5000
npm run build            # tsc compile + prisma generate → dist/
npm run start            # Run compiled dist/index.js
npx tsc --noEmit         # Type-check only
```

### Client (run from `client/`)
```bash
npm run dev              # Vite dev server on port 3000
npm run build            # Production build → client/dist/
```

### Database (run from `server/`)
```bash
npm run prisma:migrate        # Apply migrations (dev) + regenerate client
npm run prisma:migrate:prod   # Deploy migrations (production)
npm run prisma:seed           # Seed with dev users (alice@uni.edu / bob@uni.edu)
npm run prisma:studio         # Open Prisma Studio GUI
npm run prisma:generate       # Regenerate Prisma client after schema changes
```

### Production
```bash
./scripts/deploy.sh           # Full build + deploy
./scripts/production-check.sh # Pre-deploy readiness check
pm2 start ecosystem.config.cjs # Start via PM2 (server/) — .cjs, since the package is ESM
```

Server wall-clock times (operating-hours checks, the booking scheduler, email
timestamps) use the process's local timezone via `Date#getHours`. `ecosystem.config.cjs`
pins `TZ=Asia/Bangkok` so production doesn't inherit the host default (UTC).

## Architecture

### Data flow
The client polls the API every 5 seconds (`App.tsx`) for rooms and bookings. State is lifted to `App.tsx` and passed as props to pages — there is no client-side state management library.

### Server structure
- `server/src/index.ts` — Express app entry: registers all routers, security middleware (Helmet, CORS, rate limiting), and starts the booking scheduler
- `server/src/routes/` — Route handlers per resource: `auth`, `users`, `rooms`, `bookings`, `admin`, `semesters`, `settingsRoutes`
- `server/src/middleware/auth.ts` — JWT verification middleware (attach to protected routes)
- `server/src/middleware/security.ts` — Rate limiters (`apiLimiter`, `authLimiter`, `strictLimiter`)
- `server/src/services/bookingScheduler.ts` — `node-cron` job that auto-completes past bookings
- `server/src/controllers/settingsController.ts` — CRUD for `ServiceSettings` (branding config)
- `server/prisma/schema.prisma` — Single source of truth for DB schema (SQLite in dev, MySQL/PostgreSQL in prod)

### Client structure
- `client/App.tsx` — Root: auth state, data fetching, global modals, routing
- `client/services/api.ts` — All HTTP calls via `fetchAPI()` helper; JWT stored in `localStorage`
- `client/contexts/SettingsContext.tsx` — Provides branding settings (service name, logo) app-wide
- `client/contexts/ToastContext.tsx` — Global toast notifications
- `client/i18n.ts` + `client/locales/{en,th}.json` — react-i18next EN/Thai translations covering ALL screens (user + admin). UI language persisted in `localStorage['lang']` (per-device), switcher in the `Layout` header also saves to `PUT /users/me/language` (drives notification-email language via `User.language`). Format dates with `dateLocale()` from `client/i18n.ts` (returns `th-TH-u-ca-gregory` for Thai to keep Gregorian years), never hardcode `'en-US'` in user-facing components. Server-side: `fetchAPI` sends `Accept-Language`; **all** user-facing API messages localize through the catalog in `server/src/services/i18n.ts` — use `trReq(req, 'key')` in route handlers (or `tr(lang, 'key')` where a `lang` is already held), never a bare English string, since the client toasts `body.error` verbatim. `middleware/validation.ts` validators carry a message **key** in `withMessage()` and `handleValidationErrors` resolves it. Approval/cancellation/reminder emails render in the recipient's stored language (admin approval-request emails stay English)
- `client/pages/` — `HomePage` (room timeline/booking), `MyBookingsPage`, `AdminPage`, `AuthCallbackPage` (Microsoft SSO)
- `client/components/` — Feature components; `Timeline.tsx` is the main booking UI

### Database schema key points
- `features` on `Room` is stored as a **JSON string**, not a DB array — parse/stringify manually
- `Department` is an optional grouping for rooms (`Room.departmentId` is nullable, SetNull on delete). A department's `operatingHours` (same JSON format as settings) overrides the global schedule for its rooms; null = inherit global
- `Room.operatingHours` (same JSON format) overrides its department's schedule for that one room; null = inherit the department, or global if it has none. A set schedule **replaces** the tier above rather than intersecting it, so a room may open earlier or later than its department. Edited via the inherit/custom toggle in Add/Edit Room
- `DepartmentAdmin` grants a user (any role) management rights over one department: edit the department, its rooms, and view/cancel/remind/approve its bookings. Server checks live in `server/src/services/permissions.ts`; auth responses expose `managedDepartmentIds` to the client
- Roles: `SUPERADMIN` > `ADMIN` > `STUDENT_WORKER` > `STUDENT`. Only SUPERADMIN can edit Service Settings, change roles, or manage admin accounts; ADMIN has full operational powers. `ADMIN_EMAILS` env entries bootstrap as SUPERADMIN on first SSO login
- Rooms with `requiresApproval` create bookings as `PENDING` (slot is held; blocks overlaps). Staff or the room's department admins approve (`POST /bookings/:id/approve`) or reject; the scheduler auto-cancels PENDING bookings whose start time passes
- `ScheduleException` holds date-specific overrides (holidays, closures, special hours), service-wide (`departmentId` null) or per-department; dept-specific beats service-wide. Schedule resolution order: semester gate → exception → room weekly hours → department weekly hours → global weekly hours (`resolveDayHours`/`checkBookingSchedule` in `server/src/services/settings.ts`, mirrored in `client/utils/operatingHours.ts`). Note exceptions are still only service-wide or per-department — there is no single-room closure. Managed in Admin → Closures
- `AuditLog` is an append-only trail of privileged actions (`server/src/services/audit.ts`). Call `recordAudit(req, {...})` from a route, or `recordSystemAudit({...})` for scheduler actions — an audit write must never fail the operation it describes, so `persist()` swallows and logs errors. The actor is stored **denormalised with no FK to User**: a relation would either block deleting a user or erase their history with them. `targetLabel` likewise captures the name as it was. Read via `GET /audit` (global admins see everything; department admins only entries for departments they manage; nobody else). There is intentionally no write/update/delete endpoint
- `User.provider` defaults to `"LOCAL"`; Microsoft SSO users have a different provider value
- `Booking` → `Attendee` cascade deletes on booking removal
- `ServiceSettings` is a singleton row (only one settings record expected). Besides branding, it holds:
  - `allowedEmailDomains` — comma-separated domain allowlist for registration/SSO; empty = any domain
  - `operatingHours` — JSON string: array of 7 entries (Sun..Sat), each `{open, close}` in hours or `null` (closed). Enforced server-side on booking creation and rendered by `Timeline`/`DayView`. Parsing helpers: `server/src/services/settings.ts` and `client/utils/operatingHours.ts`

## Environment Variables

### Server (`server/.env`)
```
DATABASE_URL=        # SQLite: "file:./dev.db" | MySQL: "mysql://..." | PG: "postgresql://..."
JWT_SECRET=          # Required — strong random string
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
ADMIN_EMAILS=        # Comma-separated emails auto-granted ADMIN on first SSO sign-in
```

## Switching Databases

When switching from SQLite to MySQL/PostgreSQL:
1. Update `provider` in `server/prisma/schema.prisma`
2. Update `DATABASE_URL` in `.env`
3. Delete `server/prisma/migrations/` (SQLite migrations are incompatible)
4. Run `npm run prisma:migrate` to create fresh migrations

## Default Dev Credentials (seed only)
- Student: `alice@uni.edu` / `student123`
- Admin: `bob@uni.edu` / `admin123`
