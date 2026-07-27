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
pm2 start ecosystem.config.js # Start via PM2 (server/)
```

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
- `client/pages/` — `HomePage` (room timeline/booking), `MyBookingsPage`, `AdminPage`, `AuthCallbackPage` (Microsoft SSO)
- `client/components/` — Feature components; `Timeline.tsx` is the main booking UI

### Database schema key points
- `features` on `Room` is stored as a **JSON string**, not a DB array — parse/stringify manually
- `Department` is an optional grouping for rooms (`Room.departmentId` is nullable, SetNull on delete). A department's `operatingHours` (same JSON format as settings) overrides the global schedule for its rooms; null = inherit global
- `DepartmentAdmin` grants a user (any role) management rights over one department: edit the department, its rooms, and view/cancel/remind/approve its bookings. Server checks live in `server/src/services/permissions.ts`; auth responses expose `managedDepartmentIds` to the client
- Roles: `SUPERADMIN` > `ADMIN` > `STUDENT_WORKER` > `STUDENT`. Only SUPERADMIN can edit Service Settings, change roles, or manage admin accounts; ADMIN has full operational powers. `ADMIN_EMAILS` env entries bootstrap as SUPERADMIN on first SSO login
- Rooms with `requiresApproval` create bookings as `PENDING` (slot is held; blocks overlaps). Staff or the room's department admins approve (`POST /bookings/:id/approve`) or reject; the scheduler auto-cancels PENDING bookings whose start time passes
- `ScheduleException` holds date-specific overrides (holidays, closures, special hours), service-wide (`departmentId` null) or per-department; dept-specific beats service-wide. Schedule resolution order: semester gate → exception → department weekly hours → global weekly hours (`resolveDayHours`/`checkBookingSchedule` in `server/src/services/settings.ts`, mirrored in `client/utils/operatingHours.ts`). Managed in Admin → Closures
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
