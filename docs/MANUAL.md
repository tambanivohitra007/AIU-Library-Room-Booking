# Operations Manual

How to reserve a room, how requests get approved, and how the service is configured.

Three parts, one for each kind of reader. Start with the one that describes you.

| If you… | Read |
|---|---|
| book rooms (students, faculty, anyone) | [Part One — Booking a room](#part-one--booking-a-room) |
| approve requests (department managers, staff, student workers) | [Part Two — Approving requests](#part-two--approving-requests) |
| run the service (super admins, IT) | [Part Three — Administration](#part-three--administration) |

> Every rule described here is enforced by the **server**. The interface reflects those rules but never
> applies them, so a settings change takes effect on the next request — no restart, no redeploy.

A shareable web version of this manual is published at
<https://claude.ai/code/artifact/5a9bb6c3-c734-473e-8fda-e624c22c54c6>. This file is the source of truth;
update it first.

---

## Part One — Booking a room

Applies to every signed-in account. No special permissions are needed to book.

### Signing in

Most people use **Sign in with Microsoft** with their institutional account — no separate password, and name
and email come across automatically.

Local email-and-password accounts also exist, usually created by an administrator or bulk-imported. Whether
anyone can create their own is a setting: when self-registration is off — the default — the **Create an
account** option is hidden entirely. When it is on, new accounts still wait for administrator approval before
they can book.

Your institution may restrict which email domains may sign in. If yours isn't on the list, sign-in is refused
with a message naming the accepted domains.

**Language.** The `EN / ไทย` button in the header switches the whole interface. The choice is remembered on
that device and also sets the language of the emails you receive.

### Finding a room and booking it

The **Rooms** page is a calendar: a left sidebar with a mini calendar and the room list (grouped by
department, searchable by name, description, features, or department), and a main area showing day, week, or
month for the selected room.

1. **Pick a room and a date.** Closed hours and other people's bookings are blocked out, so anything
   selectable is genuinely free.
2. **Drag across the time you want.** Selection works in 15-minute steps. **New Booking** finds the next free
   slot automatically if you'd rather not hunt.
3. **List who is coming.** One companion per line. **You are counted automatically** — the total shown
   includes you, and that total must fit the room's minimum and maximum.
4. **Say what it's for, and accept any terms.** Some rooms carry conditions of use; where they exist you must
   tick to accept, and the time of acceptance is recorded.
5. **Confirm.** Ordinary rooms are booked immediately. Rooms that need approval become a request.

### What the statuses mean

| Status | Meaning | Room held? |
|---|---|---|
| `PENDING` | Waiting for a manager to approve. You did nothing wrong — this room requires approval. | Yes |
| `CONFIRMED` | The room is yours for that time. | Yes |
| `CANCELLED` | Cancelled by you, by a manager, or automatically. A reason is shown where one was given. | No |
| `COMPLETED` | Finished. Applied automatically once the end time passes. | No |

A `PENDING` request holds its slot exactly like a confirmed one. Nobody else can book over it while it waits,
so there is no need to make a backup reservation.

### Rooms that need approval

Some rooms are set so bookings are requests rather than reservations. The booking form says so before you
submit, and the result stays `PENDING` until a department manager approves or rejects it.

**Requests need notice.** Because a person has to act on it, a request cannot be made at the last moment. The
required notice — **one hour by default** — is shown on the booking form, and **Confirm** stays disabled for a
slot starting sooner than that. Your institution can lengthen, shorten, or remove this period.

**If nobody responds**, a request still waiting when its start time arrives is **cancelled automatically** and
the slot released. If your booking matters and the start time is approaching, contact the department directly
rather than waiting.

```
You submit → PENDING → approved → CONFIRMED
                     → rejected or start time passes → CANCELLED
```

### Email you'll receive

Messages arrive in whichever language you last selected in the app.

| When | What it says |
|---|---|
| Your request is approved | Booking approved, with room, date, and time |
| Your request is rejected | Booking cancelled, including the manager's reason |
| Your booking is cancelled | Booking cancelled, with the reason where one was recorded |
| 30 minutes before the start | A reminder, sent once, for confirmed bookings only |

**There is no confirmation email.** Booking an ordinary room sends you nothing — the reservation is simply
made. **My Bookings** is the authoritative record.

### Changing or cancelling

Open **My Bookings** and use **Cancel Booking**. Confirmed bookings and pending requests can both be
withdrawn; completed and already-cancelled ones cannot.

There is no edit function. To move a booking, cancel it and make a new one — which also frees the old slot for
someone else immediately.

### If a booking is refused

Every rule is checked server-side, so the message you get is the real reason.

| Message | What to do |
|---|---|
| This time slot is no longer available | Someone booked it while you were filling in the form. Pick another slot. |
| Only available between 8:00 and 22:00 | Outside opening hours for that room on that weekday. Hours differ per room and per department. |
| Closed for *[name of closure]* | A holiday or closure covers that date. Choose another day. |
| This room requires between 2 and 6 people | Add or remove companions. The count includes you. |
| Requests must be made at least 1 hour before… | This room needs approval and you're inside the notice window. Choose a later time. |
| Bookings are only allowed within the current semester | The date falls outside the active term. Contact an administrator if that looks wrong. |
| Bookings must start and end on the same day | Split it into one booking per day. |

---

## Part Two — Approving requests

For department managers, library staff, and student workers — anyone who acts on other people's bookings.

### What you control

Being a **department manager** is an assignment, not a job title: an administrator adds you to one or more
departments. Within those departments you can see full booking details, approve and reject requests, cancel
bookings, send reminders, manage the rooms, and edit the department itself. Outside them you are an ordinary
user — other people's bookings appear as busy time with no name attached.

Library staff and student workers are not scoped this way; they can act on any booking in the service.

Everything is under **Admin** in the navigation. If managing a department is your only privilege, the Admin
area opens straight onto **Bookings** and shows only the tabs you can use.

### The notification bell

The bell in the header is the reliable channel — email can be missed, filtered, or sent to someone on leave.
It appears only for people who can actually approve something.

- The **amber badge counts requests still waiting on you**, in your departments only. It reflects outstanding
  work, so it does not clear just because you looked at it.
- Requests arriving since you last opened it are marked as new.
- A **red dot** means the booking starts within the hour — that one cannot wait.
- Clicking a notification opens the Bookings list narrowed to exactly that request, with a button to widen it
  again.

The badge updates on its own every few seconds; no refresh needed.

### Reviewing the queue

Open **Admin → Bookings**. Pending requests are pulled to the top regardless of date, ordered by whichever
starts soonest, so the most urgent is the first row. An amber banner appears whenever anything is waiting, and
the Bookings tab carries a count badge visible from any other tab.

Use the status filter to show **Pending** alone, or the banner's **Review now** button, which does the same in
one click.

**Approving and rejecting.** Each pending row has **Approve** and **Reject**. Approving confirms the booking
and emails the requester. Rejecting asks for a reason, which is stored and included in the email — leave it
blank and a neutral default is used. Both actions are recorded in the audit trail against your name. On a
phone the same two buttons appear on each pending card.

### The deadline

A request expires at **its own start time**, not on a fixed timer. A booking for next Tuesday sits safely
until next Tuesday; one for this afternoon needs attention this morning. When the start time passes without a
decision, the system cancels it automatically and records that in the audit log.

> **The practical consequence.** Turning on approval for a room means someone has to watch the queue. If
> nobody does, requests don't pile up — they quietly die, and the person who asked is told their booking was
> cancelled.

### Reminders and cancelling on someone's behalf

Confirmed bookings carry a **Remind** button that emails the booker immediately — useful when a room is needed
and you want to check the holder still intends to use it. This is separate from the automatic reminder sent 30
minutes before every confirmed booking.

**Cancel** ends a booking and emails the holder. Give a reason: it is stored on the booking, shown to them in
the app, and included in the email. Cancellations are recorded in the audit trail with your name against them.

### Your rooms and closures

Within your departments you can add, edit, and remove rooms. The settings that shape behaviour:

- **Capacity range** — minimum and maximum people, counting the booker.
- **Requires approval** — turns bookings into requests. Consider who will watch the queue before enabling it.
- **Terms & conditions** — text the booker must accept; acceptance is timestamped.
- **Operating hours** — inherit the department's schedule, or set hours for this one room. A custom schedule
  *replaces* the department's rather than narrowing it, so a room may open earlier or later than its
  department.
- **Features** — searchable labels such as a whiteboard or projector.

**Admin → Closures** handles holidays and one-off changes. A closure can shut a date entirely or set special
hours for it, and can apply to your department alone or service-wide. A department closure overrides a
service-wide one for the same date.

**Admin → Audit** shows who did what: approvals, rejections, cancellations, and changes to rooms, closures,
and the department. You see entries for your own departments. It cannot be edited or deleted by anyone.

### If approval emails aren't arriving

Every request emails **both** of the following, together:

- The **department's contact email** — several addresses can be listed, separated by commas.
- Everyone **assigned as a manager** of that department.

The service-wide contact address is used only as a fallback, when a department has neither contacts nor
managers, so a request is never left unwatched.

> **A common surprise.** Holding the ADMIN role does **not** put you on this list. Global administrators are
> not emailed about pending requests unless their address is a department or service contact, or they are
> assigned as a manager of that department. If you expect these emails, check you are on one of those lists —
> and use the bell, which never depends on mail delivery.

A room with no department falls back to the service contact address, and no department manager can be scoped
to it. Rooms that need approval should belong to a department.

---

## Part Three — Administration

Configuration, access control, and running the service. Some of this is restricted to super admins.

### Roles and department grants

Access is the sum of two independent things: a **role**, which is global, and any **department grants**, which
are scoped.

| Capability | Student / Faculty | Student worker | Dept. manager | Admin | Super admin |
|---|---|---|---|---|---|
| Book rooms, manage own bookings | ✅ | ✅ | ✅ | ✅ | ✅ |
| See booking details, cancel, remind | — | ✅ | own depts | ✅ | ✅ |
| Approve / reject requests | — | ✅ | own depts | ✅ | ✅ |
| Manage rooms | — | — | own depts | ✅ | ✅ |
| Manage departments | — | — | edit own | ✅ | ✅ |
| Manage users and semesters | — | view users | — | ✅ | ✅ |
| Change roles, manage admin accounts | — | — | — | — | ✅ |
| Service settings | — | — | — | — | ✅ |

> **The rule people get wrong.** A department grant **adds reach; it never removes any**. Giving an ADMIN a
> grant for one department does not confine them to it — they keep authority everywhere.
>
> To confine someone to a single department you must do **both**: set their role to **FACULTY** (or Student)
> **and** add them as a manager of that department.

FACULTY and Student carry identical permissions. FACULTY exists purely so a department head isn't labelled a
student in the interface. Either way, they see full booking details only for their own bookings and for
departments they have been granted — everywhere else, other people's bookings show as busy time with no name,
purpose, or attendee list.

Assign managers under **Admin → Departments**. Any user can be appointed, whatever their role. Changing a role
or suspending an account takes effect on the person's very next action, not when their session expires.

Addresses in the `ADMIN_EMAILS` environment variable become super admins the first time they sign in with
Microsoft. That is the intended way to create the first one.

### Service settings

**Admin → Settings**, super admins only. One page, applying service-wide.

| Setting | Effect |
|---|---|
| Service name, description, logo | Branding throughout the app, the sign-in page, and every email |
| Contact emails | Shown in email footers; last-resort recipient for approval requests when a department has neither contacts nor managers |
| Allowed email domains | Comma-separated allowlist for sign-in and registration. Empty = any domain |
| Allow self-registration | Off by default. When off, account creation is hidden and people join only by SSO, admin creation, or import |
| Approval notice period | Minimum minutes between a request and its start, for rooms needing approval. Default `60`. `0` allows last-minute requests. Maximum `10080` (7 days) |
| Operating hours | Default weekly schedule, per weekday, used by any room whose department hasn't set its own |

> **Setting the notice period.** Raising it protects managers from requests they cannot realistically answer.
> Lowering it to `0` lets people request a room starting in minutes — which the scheduler will auto-cancel
> almost immediately if nobody is watching. Pick a value someone can actually meet.

### Hours, closures, and semesters

Opening hours resolve from the most specific source available. Each level **replaces** the one above it rather
than narrowing it, so a room can legitimately open earlier than its department.

```
Semester window → Closure for that date → Room hours → Department hours → Global hours
```

**Semesters** gate everything. Exactly one is active, and bookings outside its window are refused no matter
what the hours say. A service with no active semester rejects every booking with *"Bookings are only allowed
within the current semester"* — the single most common cause of a service that appears completely broken after
setup.

**Closures** handle specific dates: a full closure or special hours, service-wide or for one department, with
the department entry winning where both apply. There is no single-room closure — set the room's own weekly
hours instead, or close the department.

### Email and sign-in setup

Mail goes out through the **Microsoft Graph API**, not SMTP, sent as the mailbox named in `SMTP_USER`. Four
values must be present in `server/.env`:

```env
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
SMTP_USER=notifications@example.edu
```

The Azure app registration needs the **Mail.Send** *application* permission, granted by an administrator.
Microsoft SSO additionally needs `AZURE_REDIRECT_URI` to match the registration exactly.

> **Failures are silent by design.** If credentials are missing or the permission was never granted, the
> system logs a warning and carries on — the booking still succeeds, the email simply never arrives. A
> misconfiguration therefore looks identical to "no requests came in". Test by booking an approval-gated room
> and confirming a message reaches the department contact.

`CLIENT_URL` must match the address the app is served from. It controls the links in emails and the CORS
allowlist; getting it wrong breaks sign-in with browser console errors.

### The background scheduler

Every five minutes the server sweeps the booking table:

| Action | Applies to | Recorded? |
|---|---|---|
| Marks bookings completed | Confirmed bookings whose end time has passed | One summary audit row per run |
| Cancels expired requests | Pending requests whose start time has passed | One audit row each |
| Sends reminders | Confirmed bookings starting in 5–30 minutes, once each | Logged |

> **Timezone.** Opening-hours checks, the scheduler, and email timestamps all use the server's local clock. If
> the host runs on UTC, bookings get refused during genuine opening hours. Set the zone on the host and keep
> `TZ` pinned in `server/ecosystem.config.cjs`.

### Deploying an update

On the production server, from the project root:

```bash
git fetch --all
git reset --hard origin/main
sudo ./scripts/deploy.sh
```

The script checks prerequisites, aligns the database provider to your connection string, builds both halves,
**backs the database up before any schema change**, applies additive schema updates, reloads nginx and PM2,
then polls the health endpoint.

> **Two things that destroy a server.**
>
> Use `git reset --hard`, not `git pull` — the deploy script rewrites one line of the Prisma schema on every
> run, so the working tree is always modified and a pull will stall on the conflict.
>
> Never run `git clean -fdx` here. `server/.env` is untracked and nothing else holds a copy: cleaning it
> destroys your `JWT_SECRET` — unrecoverable, and every user is signed out — along with your database
> credentials. Keep a copy off the server.

Rolling back is safe. Schema changes are additive and never drop columns, and every deploy leaves a database
dump in `./backups/`. Reset to the previous commit and run the script again.

After deploying, hard-refresh the browser. The client bundle is content-hashed and a stale cache keeps showing
the old build.

### Diagnosing problems

| Symptom | Cause and fix |
|---|---|
| Every booking refused, "only allowed within the current semester" | No active semester covers today. Create and activate one under Admin → Semesters |
| Bookings refused during genuine opening hours | Server running in the wrong timezone, almost always UTC. Fix the host zone and `TZ` |
| No approval emails | Check Azure credentials and the **Mail.Send** application permission, then confirm the department has contacts or managers assigned |
| Server exits immediately on start | `JWT_SECRET` is missing. The server refuses to run in production without one |
| Sign-in fails with CORS errors | `CLIENT_URL` doesn't match the address the app is served from |
| "Self-registration is disabled" | Working as intended. Enable it in Settings, or create the account yourself |
| Requests keep auto-cancelling before anyone sees them | The approval notice period is too short for how often the queue is checked. Raise it in Settings |
| Interface unchanged after a deploy | Cached bundle. Hard-refresh with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> |

**Where to look:**

```bash
pm2 status                   # is the API running?
pm2 logs aiu-library-api     # API logs, including mail failures
sudo tail -f /var/log/nginx/error.log
```

Application logs are written to `server/logs/`. Inside the app, **Admin → Audit** is an append-only record of
every privileged action — who approved, rejected, or cancelled what, and every change to rooms, departments,
closures, semesters, users, and settings. Scheduler actions are attributed to the system.

---

## Related documentation

- [README.md](../README.md) — overview, development setup, API reference
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — server setup, SSL, backups
- [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) — pre/post deployment checks
- [USER_IMPORT.md](USER_IMPORT.md) — bulk CSV user import
