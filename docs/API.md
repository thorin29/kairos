# Kairos API (v1) — mobile client contract

Status: **partly built.** The identity model is settled (per-person device
tokens) and the auth/identity surface is implemented: phones onboard by
redeeming an invitation code via `POST /auth/join`, and `POST /auth/refresh`,
`POST /auth/revoke`, `POST /auth/reauth`, `GET /me`, and `GET /meta` round out
the surface. Everything else below remains a **proposal** until built. This
document is the contract the native Android client and the Next.js backend both
hold to, so the client is never coupled to Next.js implementation details.

The web app talks to the backend through Next.js Server Actions and will keep
doing so. This REST surface is **additive** — a second door onto the same
domain logic, not a replacement. Business rules (chore expiry, scoring, plan
generation, derived state) stay in one place on the server; both doors call the
same logic.

---

## The one decision that gates everything: identity

The web dashboard is deliberately a **shared household screen with no
per-person sign-in** (see ARCHITECTURE.md, "There is no per-person sign-in").
Everyone sees everything; the only lock is the admin PIN.

A personal mobile app breaks that assumption: a phone belongs to one person and
should open to *their* chores, *their* points, *their* reading. So the mobile
client introduces the first genuine per-person identity the system has had.

**Decided (v0.177): option 1, per-person device tokens.** The three shapes that
were weighed are kept below for the record; the contract implements option 1.
The three shapes were:

1. **Per-person device tokens (recommended).** Enrollment binds a device to a
   `Person`. The token *is* the identity; there is no password login on the
   phone. A parent enrolls each device from the admin area (QR or short code).
   Fits the existing "no passwords, household-managed" model and needs no new
   credential system. The web app stays identity-free; identity lives only on
   the mobile edge.
2. **Full personal accounts.** Each person gets real credentials
   (email/password already exist in `accounts.ts`). More standard, but pulls
   real per-person auth into a system that deliberately avoided it, and raises
   the question of whether the web app should then know who's looking too.
3. **Single household token, person picked in-app.** Simplest; the phone is
   just a portable dashboard. Loses the "opens to just me" benefit that made
   native attractive in the first place.

**Chosen: option 1.** It preserves the household model, requires no new password
surface, and keeps the web app unchanged. Identity lives only on the mobile
edge; the web wall tablet stays identity-free.

As built: a parent invites a person from the admin area, which issues a
single-use **invitation code** (emailed to the address on file, and shown in the
admin panel). On the phone the person enters that code and sets or confirms a
password via `POST /auth/join`, which enrolls the device and returns a long-lived
**device token** (a bearer token) in one step. Only a SHA-256 of each secret is
stored — invitation codes and device tokens alike — so a database leak yields
nothing usable. The
token is rotatable (`/auth/refresh`) and revocable (`/auth/revoke`), and expires
on its own after a year. See DECISIONS.md for the full record and the concrete
request/response shapes under "Auth & identity" below.

Now that the token surface exists, the Authelia bypass is unblocked but must be
scoped to `/api/v1` only (DECISIONS.md). `/api/v1` authenticates every request
itself; it is exempt from the app's own login-gate middleware and never relies
on Authelia to protect it.

---

## Conventions

- Base path `/api/v1`. The major version is in the path; v1 never gets a
  breaking change, only additive fields. A breaking change is a new `/api/v2`.
- JSON only. `Content-Type: application/json`. UTF-8.
- Dates that mean a calendar day are `YYYY-MM-DD` strings, never timestamps —
  the app already treats a chore's day as a date, not an instant
  (ARCHITECTURE.md, "Dates are not timestamps"). Real instants (created-at,
  notification times) are RFC 3339 UTC.
- Money is integer minor units (cents), never floats.
- Auth: `Authorization: Bearer <device-token>` on every request except the
  public onboarding endpoints (`/auth/join`, `/auth/join/check`, `/auth/forgot`,
  `/auth/login`) and the version handshake (`/meta`).
- The client sends only inputs; the server derives everything else and rebuilds
  computed state on arrival (ARCHITECTURE.md, "Derived state is computed, not
  stored"). The client never sends a score, a streak, or an expiry it computed.

## Errors

Uniform envelope, so the client has one error path:

```
{ "error": { "code": "forbidden", "message": "human readable" } }
```

Codes: `unauthenticated`, `missing_bearer`, `invalid_token`, `device_revoked`,
`device_expired`, `forbidden`, `not_found`, `rate_limited`, `validation`,
`conflict`, `server`. HTTP status mirrors the code. `validation` carries a
`fields` map. Never leak stack traces or which of identifier/secret was wrong
(matches the existing login behaviour).

Device-token rejection is split so clients (and logs) can tell a missing
credential from a dead one: `missing_bearer` (no Authorization header — a
transient/client-state issue, never a reason to drop enrollment), `invalid_token`
(unknown/inactive), `device_revoked`, `device_expired`. Login/reauth
wrong-password failures and the ingest-token check keep the generic
`unauthenticated`. Older clients that don't know the new codes treat any
unrecognised 401 as a recoverable server error, so the split is safe to roll out
before the app updates.

## Versioning & compatibility

- Additive-only within v1: new endpoints and new response fields are fine;
  removing or renaming a field is not.
- The client tolerates unknown fields.
- `GET /api/v1/meta` returns `{ apiVersion, appVersion, minClient }` so the
  backend can ask an old app to update.

---

## Endpoints (v1 proposal)

Grouped by the domains that already exist as server actions. This is the
surface a personal mobile client needs, not a mirror of every web feature.

### Auth & identity — **built**

```
POST /api/v1/auth/join          redeem an invitation code (+ set/confirm password) -> device token + person
POST /api/v1/auth/join/check    is this code valid, and does the account already have a password?
POST /api/v1/auth/forgot        request a password-reset code by name/email (always answers "ok")
POST /api/v1/auth/login         verify username/password -> person (backs the app's unlock flow)
POST /api/v1/auth/reauth        re-confirm the password after a credential change (keeps the device)
POST /api/v1/auth/refresh       rotate this device's token
POST /api/v1/auth/revoke        revoke (sign out) this device
GET  /api/v1/me                 the enrolled person
POST /api/v1/me/avatar          set the photo and/or its framing (multipart: image?, position)
POST /api/v1/me/avatar/companion  use an owned companion as the picture (v0.582, below)
GET  /api/v1/meta               version handshake (no auth)
```

**Onboarding model (DECISIONS.md).** A parent invites a person from the admin
area; that issues a single-use **invitation code** (emailed to the address on
file, and shown in the admin panel). The person enters the code in the app and
sets a password (new account) or confirms the existing one, and the phone is
enrolled — all in one `POST /auth/join`. There is no separate device-code step:
the invite *is* the enrollment. A leaked password alone can't enrol a new device
(it needs an invite); an invite alone can't take over a password account (joining
an existing account requires confirming its current password).

Every success response below is the raw JSON object (there is no `{ ok, data }`
envelope); errors are the shared `{ "error": { "code", "message", "fields"? } }`
shape, HTTP status mirroring the code.

**`POST /auth/join`** — no bearer. Public by design (a new phone anywhere),
guarded by the invite's short life, single use, and per-source + per-invite rate
limiting.
```
request:  { "token": "ABCD2345", "password": "…",
            "deviceName": "Ellie's Pixel" }              // deviceName optional
200:      { "token": "<device-token>",
            "expiresAt": "2027-08-28T00:00:00.000Z",
            "person": { …see /me… } }
403:      forbidden       — invite invalid/expired, or wrong password on an existing account
422:      validation      — token or password missing, or password too weak (<6)
429:      rate_limited
```
The `token` is the invitation code — case-insensitive, and spaces/dashes are
ignored. For a brand-new account any password ≥6 chars sets it; for an existing
account the password must match the current one (that is what makes joining an
existing account a second factor). The returned device `token` goes in
`Authorization: Bearer <token>` on every later request; store it in the OS
keystore.

**`POST /auth/join/check`** — no bearer. Lets the join screen show "create a
password" vs "confirm your password" before anything is submitted, and reveals
nothing else.
```
request:  { "token": "ABCD2345" }
200:      { "valid": true, "hasPassword": false,
            "name": "Ellie", "purpose": "join" }         // valid:false for a bad/expired code
429:      rate_limited
```

**`POST /auth/forgot`** — no bearer. Requests a password reset: takes a name or
email; if it matches an active account with an email on file, a one-time reset
code is mailed there. Always answers the same, so it can't be used to discover
which accounts exist.
```
request:  { "identifier": "ellie or ellie@…" }
200:      { "ok": true }        // always, whether or not anything was sent
429:      rate_limited
```

**`POST /auth/login`** — no bearer. Verifies a username/email + password and
returns the matching person. This is **not** an enrollment step: it backs the
app's **unlock** flow, where a locked phone re-confirms its enrolled person's
password before unlocking (the device token is kept across a lock). It never
says which of identifier/password was wrong.
```
request:  { "identifier": "ellie or ellie@…", "password": "…" }
200:      { "person": { …see /me… } }
401:      unauthenticated — wrong username or password
422:      validation      — identifier/password missing
429:      rate_limited
```
**`POST /auth/refresh`** — bearer required. Rotates the secret; the presented
token stops working immediately and the response carries its replacement.
```
200:      { "token": "<new-device-token>", "expiresAt": "…" }
401:      unauthenticated — missing/invalid/expired token
```

**`POST /auth/revoke`** — bearer required. Signs this device out for good;
re-enrolling needs a fresh code from a parent.
```
200:      { "revoked": true }
401:      unauthenticated
```

**`POST /auth/reauth`** — bearer required (v0.188). For a password account, any
request returns **`401 reauth_required`** once the account's password is changed
or disabled — the device stays enrolled but must re-confirm the password. This
endpoint takes the password and brings the device current, with no re-enroll.
Passwordless children never see this.
```
request:  { "password": "…" }
200:      { "person": { …see /me… } }
401:      unauthenticated — wrong password (or bad/revoked token)
422:      validation      — password missing
429:      rate_limited
```
Clients treat `reauth_required` differently from a dead token: keep the device
token, show a password prompt, call `/auth/reauth`. A dead device token
(`invalid_token` / `device_revoked` / `device_expired`) means re-enroll; a
`missing_bearer` is a missing/racing credential and must NOT drop enrollment.

**`GET /me`** — bearer required. The person this device is enrolled to.
```
200:      { "id": "clx…",
            "name": "Ellie",            // display name if set, else short name
            "shortName": "ellie",       // the unique dashboard handle
            "avatarUrl": "/api/avatars/…" | null,   // relative to the API base
            "avatarIcon": "🦊" | null,               // emoji when an icon was picked
            "color": "#0f5c63",                       // this person's colour (added v0.204)
            "role": "ADMIN" | "MEMBER",
            "kind": "CHILD" | "PARENT" }
401:      unauthenticated
```
Exactly one of `avatarUrl` / `avatarIcon` is non-null (both null means no
avatar). `kind` is additive over the original "id, name, avatar, role" sketch so
the client can scope child-only features.

### Dashboard (one call to paint the home screen) — **built (v0.185, phase 1)**
```
GET  /api/v1/dashboard          this person's day (query: ?date=YYYY-MM-DD, default today)
```
One aggregated read so the phone paints in a single round trip; every field is
derived server-side and mirrors the web personal view (src/app/person/[id]).
```
200: { "date": "2026-09-02",
       "percent": 72 | null,                 // school excluded, like the web header
       "categories": [                        // per-category bars, school excluded
         { "category":"CHORE","label":"Chores","total":4,"complete":3,"overdue":0,"percent":75 } ],
       "overdue": [ Task, … ],
       "groups":  [ { "category":"CHORE","label":"Chores","items":[ Task, … ] } ],
       "personalReading": { "passage":"John 3","read":false } | null,  // their plan's reading today; shown in the Bible group, toggled via /reading/mark
       "upForGrabs": [ {                       // chores anyone can take today (chores only; empty unless date is today)
         "id","title","isShared":bool,         // isShared = a shared/pool chore (else released from a person)
         "releasedByName":"Sam","isOverdue":bool,"dueDate":"YYYY-MM-DD" } ],
       // upForGrabs[].furthestBehind — "your turn": you did this shared chore longest
       //   ago among the people on its Turn reminder list (admin; v0.584). Someone
       //   left off it is never flagged, and their date doesn't set the bar.
       "alwaysOpen": [ {                        // always-open chores AVAILABLE TO YOU (v0.584), tap-to-complete
         "id","title","readyAtMs":int|null,     // readyAtMs set = on cooldown until then
         "myCount":int } ],                     // times you've done it today
       "schedule": [ {                          // whole household's events today ("Today's schedule")
         "title","allDay":bool,"timeLabel","startMin":int,
         "color":"#rrggbb","ownerName","location":str|null } ] }
```
Shared-chore actions (both act for the enrolled person — "anyone can take these"):
```
POST /api/v1/chores/claim          take an up-for-grabs chore
request: { "taskId":"…" }
200: { "status":"ok" }   422: already taken / you already have it today

POST /api/v1/chores/always-open    tap an always-open chore done
request: { "choreId":"…" }
200: { "status":"ok" }   422: unavailable / still on cooldown
```
`Task` on the wire:
```
{ "id","title","category","status","dueDate":"YYYY-MM-DD",
  "subtitle": string|null,        // e.g. school "Biology · Test · due 5/9"
  "isOverdue": bool, "stale": bool,
  "locked": bool,                 // generated from a chore (parent removes it)
  "isWorkout": bool,              // a workout prompt: shown, completed via the logger
  "completable": bool,            // false for workout prompts and stale rows
  "test": { "score":int|null, "scoreMax":int } | null }
```
**A specific day (v0.531–0.532).** `?date=` builds THAT day's page — schedule,
chore badges, reading-goal progress and (for admins) ready Bible rewards — so a
page the phone caches for tomorrow carries tomorrow's numbers. Sections that
describe "now" rather than the day stay today-only: up-for-grabs, always-open,
get-ahead / school progress, workoutOverdue and the admin money banner. Full
classification: DECISIONS.md, "Which dashboard sections are the day's" (v0.531).

Phase 1 is the grouped checklist + bars. The shared-dashboard extras (claimable
pool, day schedule, reminders, companion, progression) and workout-prompt
logging are later phases; the fields above are additive-only.

### Task completion — **built (v0.185)**
Completion is uniform across the day (any `Task` row), so it lives at task level
rather than only under chores.
```
POST /api/v1/tasks/{id}/complete     mark this person's task done  (idempotent)
POST /api/v1/tasks/{id}/uncomplete   mark it not-done             (idempotent)
200: { "id", "status": "COMPLETE" | "PENDING" }
403: forbidden   — the task isn't this device's person's
404: not_found
409: conflict    — workout prompts complete via the workout logger, not here
```

### Chores overview — **built (v0.206)**
The read-only chore overview the app's Chores screen paints, mirroring the web
`/chores` page. Completion is **not** here — it's on the dashboard (`/dashboard`
+ task completion); management is the PIN-gated `/admin/chores`, web-only. Scope
is role/kind aware, driven by the token's person: a **parent OR admin** sees the whole
active household (every parent and child); a non-admin child sees only themselves.
Always-open and shared (pool) chores are household-wide for everyone. Runs the
same chore reconcile the dashboard does before reading.
```
GET  /api/v1/chores             the chore overview (read-only)
200: { "today":"YYYY-MM-DD",
       "scope":"self" | "household",
       "pause": { "name","startISO","endISO" } | null,
       "people": [                          // scoped; ordered by sortOrder
         { "person": Person,                // same wire shape as /me's person
           "stats": { "due":int,"done":int,"open":int,"missed":int },  // this week; missed = all-time
           "rotation": [                     // this week's assigned chores, non-anytime
             { "dayOfWeek":0..6,"label":"Sun","chore":"Dishes",
               "complete":bool,"pastDue":bool } ] } ],
       "alwaysOpen": [ { "id","title","today":int,"week":int } ],   // household counts
       "pool": {
         "chores": [ {                        // shared chores, excludes always-open
           "id","title","intervalDays":int,"isPaused":bool,
           "nextDueISO":"YYYY-MM-DD"|null,"outstanding":bool,
           "claimedByName":string|null,"alwaysOpen":false,
           "cooldownMinutes":int,"effort":int,"effortLocked":bool } ],
         "tally": [ { "name","color":"#rrggbb","count":int } ] } }   // shared completions, this season
```
Pool *claim* (a write) stays a future dashboard action; this page only reports
status, like the web. Supersedes the earlier `/chores/pool` sketch.

### Money — **built: per-person ledger + add + admin reward approval (v0.248)**
Mirrors the web /money page, personal-scoped from the enrolled person: a child
sees only their own ledger; a parent (kind PARENT) sees themselves + every active
child; an admin device additionally gets the outstanding Bible-reward months to
approve (no PIN — the device token proves identity). Approving a filed
transaction, editing/deleting rows, setting starting funds, and CSV import remain
web-admin-only (behind the PIN). Amounts are whole cents on the wire.
```
GET  /api/v1/money              ?user=<id>  (optional; selects whose ledger)
200: { "today":"YYYY-MM-DD",                  // household tz; the add form's date default
       "participants": [ { "person": Person, "balanceCents":int } ],  // visible people who keep a ledger
       "selectedId": string|null,
       "rows": [ MoneyRow, … ],                 // selected person's, newest first
       "roster": [ Person, … ],                 // visible active people (the add picker)
       "frequentPayments": [ string, … ],       // top payment descriptions, quick-picks
       "isAdmin": bool,                          // admin device: may approve/edit/delete/starting
       "canApproveRewards": bool,               // admin device (== isAdmin)
       "rewardMonths": [ RewardMonth, … ],       // admin only; else []
       "pendingApprovals": [ AdminRow, … ] }     // admin only: household transactions awaiting a mark

AdminRow = MoneyRow + { "userId","userName" }

MoneyRow:
  { "id","date":"YYYY-MM-DD","direction":"DEPOSIT"|"PAYMENT",
    "category":string|null,"detail":string|null,"amountCents":int,
    "status":"PENDING"|"APPROVED","kind":"MANUAL"|"STARTING"|"BIBLE_REWARD"|"BIBLE_BONUS"|"IMPORT" }

RewardMonth:
  { "periodKey":"YYYY-MM","label":"November 2025","bonusAvailable":bool,"bonusCents":int,
    "completers": [ { "userId","name","baseCents":int,"needsBase":bool } ] }

POST /api/v1/money/entry        file a deposit/payment (lands PENDING)
request: { "userId","direction":"DEPOSIT"|"PAYMENT","amountCents":int,
           "category"?:"BIRTHDAY"|"GIFT"|"HOLIDAY"|"EARNINGS"|"BIBLE"|"OTHER",  // deposits only, required
           "detail"?:string, "date"?:"YYYY-MM-DD" }                            // date defaults today
200: { "status":"ok" }   // 403 if filing for someone you may not act for

POST /api/v1/money/rewards/approve-month   admin device only
request: { "periodKey":"YYYY-MM" }          approve base (+ bonus) for the whole month
200: { "status":"ok" }

POST /api/v1/money/rewards/approve-base     admin device only
request: { "userId","periodKey":"YYYY-MM" } approve one person's base reward
200: { "status":"ok" }

Admin transaction management (admin device only; the shared web tablet keeps
these behind the PIN). CSV import stays web-only.
POST /api/v1/money/approve        { "id" }                      → { "status":"ok" }
POST /api/v1/money/unapprove      { "id" }                      → { "status":"ok" }
POST /api/v1/money/approve-all    {}                            → { "status":"ok" }
POST /api/v1/money/update         { "id","direction","amountCents":int,
                                    "category"?,"detail"?,"date"? }  → { "status":"ok" }
POST /api/v1/money/delete         { "id" }                      → { "status":"ok" }
POST /api/v1/money/starting       { "userId","amountCents":int,"date"? }  → { "status":"ok" }
```
The dashboard read (`GET /api/v1/dashboard`) additionally carries, for an admin
device, `"money": { "pendingApprovals":int, "rewardMonths":int } | null` — the
household counts that drive the home reminder banner (Review opens Money).
`Person` is the standard wire person (id, name, shortName, color, avatarUrl,
avatarPosition, avatarIcon, role, kind) as sent by /me.

### Reading — leisure book-tracker (built v0.250)
Strictly **self-only** — every route acts on the enrolled person's own books and
no one else's (distinct from the Bible reading endpoints above). A book has a
title, optional author, and a size in **pages and/or chapters** (at least one;
both allowed — progress runs on pages when both are set). `position` is the
page/chapter the reader is up to; how far they've read (`read`) and the Scholar
XP both derive from it at read time (capped at length), so re-entering the page
never double-counts. `shelved` = To read; finishing sets the position to the full
length and moves the book to Read. The client buckets into the reading queue
(`!shelved && !finished`) and the bookshelf (to-read / read).
```
GET  /api/v1/books
200: { "books": [ Book, … ] }

Book:
  { "id","title","author":str|null,
    "unit":"PAGES"|"CHAPTERS","length":int,        // the progress unit (derived)
    "pages":int|null,"chapters":int|null,
    "position":int,"read":int,                     // read = min(position,length)
    "finished":bool,"shelved":bool }

POST /api/v1/books/add       { "title","author"?,"pages"?:int,"chapters"?:int }  → { "status":"ok" }
POST /api/v1/books/log       { "id","page":int }          // the page/chapter you're up to
POST /api/v1/books/update    { "id","title"?,"author"?,"pages"?:int,"chapters"?:int,"position"?:int }
POST /api/v1/books/finish    { "id","finished":bool }     // finishing completes to 100% + un-shelves
POST /api/v1/books/shelf     { "id","shelved":bool }
POST /api/v1/books/delete    { "id" }
```
All mutations 403 unless the book is the enrolled person's own.


The person's own calendar for a view + date, mirroring the web personal calendar
(src/app/calendar/personal-calendar.tsx): events with colours already resolved
from their saved prefs, respecting their saved people/family/school-work/
subscription filters, plus the month grid + dots for the picker. Read-only —
editing, the options drawer, the time-grid views (week/3-day), and the colour
controls are later phases.
```
GET  /api/v1/calendar           ?view=(month|week|three_day|day|agenda) &date=YYYY-MM-DD
                                 both optional; fall back to saved view + today
200: { "today","view","date","heading",
       "rangeDays": [ "YYYY-MM-DD", … ],       // days this view covers
       "prevDate","nextDate",                   // paging anchors for this view
       "events": [ CalEvent, … ],               // in-range, filtered + recoloured
       "nowColor":"#rrggbb",                    // now-line colour for the time-grid views
       "monthDays": [ "YYYY-MM-DD", … ],        // 42-day grid for date's month
       "monthDots": { "YYYY-MM-DD": [ "#rrggbb", … ] },  // ≤3 colours/day
       "timezone":"America/Chicago",              // home/event tz; app localises timed events to the device tz
       "options": {                               // for the filters drawer (v0.212)
         "people": [ { "id","name","color" } ],
         "subscriptions": [ { "id","name","ownerName":str|null,"color" } ],
         "shownPeople": [ "userId", … ], "shownSubs": [ "subId", … ],
         "showFamily":bool, "showSchoolWork":bool,
         "canManageFamily":bool,                 // v0.220: parent/admin — may add to family + manage birthdays/repeats
         "eventTypes": [ { "id","name","color" } ] } }
```
`CalEvent` on the wire:
```
{ "id","eventId","title","location":str|null,"dayISO",
  "allDay":bool,"startMin":int,"endMin":int,"timeLabel":"9:00 AM",
  "color":"#rrggbb","memberColors":[ "#rrggbb", … ],   // >1 = shared, paint bands
  "isFamily":bool,"shade":bool,"kind":"APPOINTMENT",
  "ownerName","calendarName":str|null,
  "recurring":bool,"recurLabel":str|null,"external":bool,
  "schoolType":str|null,"schoolClassName":str|null }
```
```
POST /api/v1/calendar/event        create a basic personal event (v0.214, Phase 3a)
request: { "title", "allDay":bool, "date":"YYYY-MM-DD",
           "start"?:"HH:MM","end"?:"HH:MM","endDate"?:"YYYY-MM-DD",
           "location"?:str, "timezone"?:"America/Chicago",  // tz default home; sets the stored instant
           "repeat"?:"NONE"|"DAILY"|"WEEKLY"|"MONTHLY"|"YEARLY",  // v0.218; interval 1
           "isFamily"?:bool, "kind"?:"APPOINTMENT"|"CLASS"|"WORK"|"BIRTHDAY"|"OTHER",
           "eventTypeId"?:str,   // v0.220: owner (family needs parent/admin) + kind/type
           "participants"?:[ "userId", … ] }  // v0.222: share with other people
200: { "status":"ok" }   422: bad name / date / times
                                   // single occurrence, owner = enrolled person.
                                   // recurrence, participants, event types, family, editing = later.

POST /api/v1/calendar/event/update   edit an event (v0.217; recurring v0.219)
request: same body as create (incl. isFamily/kind/eventTypeId/participants) +
         "eventId","scope"?:"single"|"series","occurrenceISO"?   // v0.223: edit type/owner/participants
200: { "status":"ok" }   422: feed/not-yours/bad fields; series edit is parent-only
                                   // scope: single = just this occurrence (override);
                                   // series = the whole repeat (keeps the pattern).

POST /api/v1/calendar/event/delete   delete an event (v0.216)
request: { "eventId", "scope"?:"all"|"future"|"one", "occurrenceISO"?:"YYYY-MM-DD" }
200: { "status":"ok" }   422: feed event / not yours / repeating needs a parent
                                   // scope defaults "all"; non-admins limited to own/family;
                                   // recurring + birthdays admin-only.

POST /api/v1/reading/plan  now also accepts "endISO" (finish-by-date pace; overrides chaptersPerDay)
POST /api/v1/reading/plan/preview  { bookNames[], startISO, chaptersPerDay?|endISO? } -> { dayCount, totalChapters, startISO, endISO, days[] }  // v0.231

POST /api/v1/sport/confirm  { "eventId", "dateISO"? }  // v0.229: answer a home "Did you do X?" sport prompt (yes)
POST /api/v1/sport/decline  { "eventId", "dateISO"? }  // v0.229: (no). GET /dashboard now returns sportPrompts.

POST /api/v1/calendar/prefs        update filters/view (v0.212); all fields optional
request: { "shownPeople"?:[…], "shownSubs"?:[…], "showFamily"?:bool,
           "showSchoolWork"?:bool, "view"?:"month|week|three_day|day|agenda" }
200: { "status":"ok" }
```

### Groceries — shared shopping list (device API added v0.251)
**Shared family data**, not self-only — any enrolled device may read and write it
(the point is anyone can say "we're out of milk"). Multiple named **stores**
(Groceries, Costco…); each has a saved list of lines, a remembered **catalog**
(name → icon + default store), and at most one live **trip**. Store membership
follows the catalog: a typed name that matches a catalog item defaults to that
item's store (skip the picker when there's one store); a new item's store is
remembered on first add. Adds are attributed to the enrolled person.

A line sits on the saved list until a trip for its store is started, which pulls
it in; ticking it "bought" strikes it through but keeps it visible; completing the
trip drops the bought lines and returns the rest to the saved list. Store/catalog
editing stays web-admin only.
```
GET  /api/v1/groceries
200: { "stores":[ {id,name,icon} ],
       "saved":[ Item ], "trips":[ Trip ],
       "catalog":[ {id,name,icon,defaultStoreId:str|null} ],
       "roster":[ Person ] }

Item:   { "id","name","icon","storeId","note":str|null,
          "quantity":int|null,                    // 1-99; null = no quantity, render the name alone
          "purchased":bool,"assignee":Person|null }
Trip:   { "id","storeId","shopper":Person,"items":[ Item ],"total":int,"got":int }
Person: { "id","name","color","avatarPath":str|null,"avatarPosition":str|null }

POST /api/v1/groceries/add            { "name","storeId","note"? }        → { "status":"ok" }
POST /api/v1/groceries/add-catalog    { "catalogId","storeId"? }
POST /api/v1/groceries/remove         { "id" }                            // off the list / "got it"
POST /api/v1/groceries/quantity       { "id","quantity":int|null }        // ×N on the line, 1–99; null or out of range clears (v0.529)
POST /api/v1/groceries/purchased      { "id","purchased":bool }           // within a trip
POST /api/v1/groceries/trip/start     { "storeId","shopperId"? }          // shopper defaults to caller
     → { "ok":bool, "reason":str|null }                                   // reason "in-progress" if a run exists
POST /api/v1/groceries/trip/complete  { "tripId" }
POST /api/v1/groceries/move           { "id","storeId" }                 // move a saved line to another store
POST /api/v1/groceries/quantity       { "id","quantity":int|null }        // 1-99; null (or out of range) clears it
     // clients render a line with a quantity as "<name> \u00d7 <n>" and an item without one exactly as before

GET  /api/v1/characters                                                   // your own character sheet (companion, level, season, stats, streak, mastery)
GET  /api/v1/companion-sprite?p=<species>/<stage>.png                     // device-authed companion sprite (mirrors /public/companions)
POST /api/v1/characters/hatch         { "mode":"new"|"deepen" }            // hatch your ready egg (self only)
GET  /api/v1/characters/collection                                        // your gallery: creatures grouped by era, owned vs mystery (self only)
GET  /api/v1/coop                                                         // family goal: season, children progress, reward proposals + your votes
POST /api/v1/coop/propose            { "title","detail?" }                // propose a family reward (proposer = you)
POST /api/v1/coop/vote               { "proposalId" }                     // one vote a month: same idea = take it back, another = move it (v0.583)
POST /api/v1/coop/select             { "proposalId" }                     // parents/admins: pick the season reward
POST /api/v1/coop/grant              { "proposalId" }                     // parents/admins: hand out the reward
POST /api/v1/coop/remove             { "proposalId" }                     // parents/admins: remove a proposal
// GET /coop also carries "homeNudge": "vote" | "pick" | null (v0.583) — what the
//   home card says while no goal is chosen, for THIS person: "vote" until they've
//   voted this month, "pick" for a parent/admin, null otherwise (src/lib/coop-nudge.ts).
// Anyone may vote, parents included; nobody has to. Select / grant / remove are
//   parent-or-admin on the device API; on the web they need the admin PIN.
```

### Calendar — **built (personal calendar, editing, prefs; time model settled v0.521–0.526)**
One read paints the whole Calendar screen for the enrolled person, mirroring
`src/app/calendar/personal-calendar.tsx`: their saved view and filters, events with
colours already resolved server-side from their colour prefs, the 42-day month grid
and per-day dots, and the options-drawer data. Writes cover create, update and
delete (including recurring scope) plus prefs and reminders on subscribed events.

**Time model — read this before touching a date field.** Events are stored as real
`startsAt`/`endsAt` instants. The payload flattens each event into **per-day
segments** for layout (`dayISO`, `startMin`, `endMin`, where **`1440` means
end-of-day and is never an editable clock value**) and separately carries the
event's **true bounds** for editing (`startDayISO`, `startMinExact`, `endDayISO`,
`endMinExact`). An editor must load the exact bounds, so an overnight event opens
whole no matter which day-segment was tapped. **Midnight is `00:00` on the next
day, never `23:59`**; clock values stay in 0–1439. All-day events are **inclusive**
in the UI but **exclusive on the wire and in storage**: for `allDay: true` the
`endDate` a client sends is the day *after* the last covered day, so a one-day
all-day event on the 4th sends `date: "…-04"`, `endDate: "…-05"`. The client does
the ±1 conversion (−1 when loading into the form, +1 when saving) — see
`computeTimes()` in `src/lib/calendar/create-event.ts`. For a **timed** event
`endDate` is the real end day (used for an overnight or multi-day span), not
exclusive. The server rejects an end at or before the start.
```
GET  /api/v1/calendar?view=<month|week|three_day|day|agenda>&date=YYYY-MM-DD
     // both params optional: view falls back to the person's saved view, date to today
200: { "today","view","date","heading","timezone",
       "rangeDays":[ISO],"prevDate","nextDate",
       "events":[ CalEvent ],
       "nowColor",
       "monthDays":[ISO],                       // 42-day grid containing `date`
       "monthDots":{ ISO: [color,...] },        // up to 3 colours per day
       "options": CalendarOptions }

CalEvent: { "id","eventId","title","location":str|null,
            "dayISO","startMin","endMin","timeLabel",        // this day's segment (1440 = end of day)
            "startDayISO","startMinExact",                   // the event's true bounds —
            "endDayISO","endMinExact",                       //   use these to open the editor
            "allDay":bool,"color","memberColors":[str],"isFamily":bool,"shade":bool,
            "kind","bgKey":str|null,"ownerName","whoLabel","notes":str|null,
            "didNotAttend":bool,"attendees":[{name,state}],
            "ownerId":str|null,"eventTypeId":str|null,
            "reminders":[int],"reminderUserIds":[str],"memberIds":[str],
            "calendarName":str|null,"recurring":bool,"recurLabel":str|null,
            "external":bool,"schoolType":str|null,"schoolClassName":str|null }

CalendarOptions: { "people":[{id,name,color}],
                   "subscriptions":[{id,name,ownerName,color}],
                   "shownPeople":[id],"shownSubs":[id],
                   "showFamily":bool,"showSchoolWork":bool,
                   "canManageFamily":bool,                    // parent or admin
                   "eventTypes":[{id,name,color,defaultMinutes,defaultReminder}],
                   "colorPrefs":{ personalizeColors,othersMode,othersColor,holidayColor,
                                  familyColor,nowColor,kindColors,eventTypeColors,subColors },
                   "meColor","holidaySystemColor","familySystemColor","nowSystemColor" }

POST /api/v1/calendar/event
     { "title","date":"YYYY-MM-DD","allDay":bool,
       "start"?:"HH:MM","end"?:"HH:MM","endDate"?:"YYYY-MM-DD",
       //   timed:   endDate = the day the event actually ends (overnight/multi-day)
       //   all-day: endDate = EXCLUSIVE — the day AFTER the last covered day
       "location"?,"timezone"?,"repeat"?,"isFamily"?:bool,
       "kind"?,"eventTypeId"?,"participants"?:[id],
       "reminders"?:[minutesBefore],"reminderUserIds"?:[id],
       "notes"?:str,                  // Events (APPOINTMENT) and Medical (OTHER) only — see below
       "ownerId"?:id,                 // whose calendar; default the caller (v0.580)
       "clientId"? }                                              // offline idempotency key
     → { "status":"ok", "id" }        // validation error → { "error":"validation", ... }

POST /api/v1/calendar/event/update
     { "eventId", ...same fields as create...,
       "occurrenceISO"?:"YYYY-MM-DD",                             // which occurrence was tapped
       "scope"?:"series"|"single"|"future" }                      // default "series"
     // v0.597: occurrenceISO may be the day of ANY piece of the occurrence (the
     //   after-midnight piece of an overnight one); the server resolves it to the
     //   occurrence's start day (occurrenceOfRow). A series edit shifts the
     //   series only by how far `date` moved off that occurrence.
     → { "status":"ok" }

// notes (v0.580): kept only when takesNotes(kind, eventTypeId) — kind APPOINTMENT
//   or OTHER with NO custom eventTypeId (a custom type such as a hockey game
//   stores as OTHER but is deliberately excluded). Trimmed, capped at 500 chars;
//   anything else is stored as null, which also clears a note left by an
//   earlier type. One rule: src/lib/calendar/event-notes.ts (phone: NoteField.kt).
//   On update an omitted "notes" keeps the stored note.
// ownerId (v0.580): resolved once in create-event.ts (resolveOwner) and
//   re-checked — a non-parent can only file under themselves; never trusted
//   from the request. Ignored when isFamily is true.
// Importing an .ics (web 0.581 / app 0.389) adds no endpoint: the file only
//   fills in the New event form, which saves through this same call.

POST /api/v1/calendar/event/delete
     { "eventId", "scope"?:"all"|"future"|"one", "occurrenceISO"? }   // default "all"
     → { "status":"ok" }
     // v0.597: occurrenceISO resolved to its occurrence's start day, as on update
     // non-admins may delete only their own or family events; recurring events and
     // birthdays stay admin/parent-only; feed (subscribed) events cannot be deleted here

POST /api/v1/calendar/prefs
     // every field optional; only the ones present are written
     { "view"?, "shownPeople"?:[id], "shownSubs"?:[id],
       "showFamily"?:bool, "showSchoolWork"?:bool,
       "personalizeColors"?:bool, "othersMode"?:"own"|"grey"|"family",
       "othersColor"?, "holidayColor"?, "familyColor"?, "nowColor"?,   // "#rrggbb" or null to clear
       "kindColors"?, "eventTypeColors"?, "subColors"? }               // { key: "#rrggbb" }
     → { "status":"ok" }

POST /api/v1/calendar/subscribed-reminders
     { "eventId", "reminders":[minutesBefore] }    // [] clears; reminders on feed events are app-only
     → { "status":"ok" }
```
Notes: the GET refreshes stale ICS feeds **in the background** (single-flight) and
returns what the database already holds, so a fresh feed shows up on the next load
rather than blocking this one. Colours arrive resolved — the client should not
re-derive them.

### Birthday — **built (v0.589)**
```
GET  /api/v1/me/birthday          200: { "birthday":"YYYY-MM-DD"|null }
POST /api/v1/me/birthday          { "birthday":"YYYY-MM-DD"|null|"" }  // null/"" clears
200: { "birthday" }   400 validation: not a real date, before 1900, or in the future
```
The same `User.birthday` the web profile edits (shown on the calendar yearly);
one rule for both, `checkBirthday` in src/lib/birthday.ts.

### Home-screen widget (Android) — **built (v0.588)**
```
GET /api/v1/widget?scope=family|mine          // anything but "mine" = family
200: { "today":"YYYY-MM-DD", "scope":"family"|"mine",
       "overdueTasks":int,                    // the person's open tasks from before today
       "days":[ { "date", "tasks":[ { "id","title" } ],
                  "events":[ CalEvent ] } ] } // only days with something on them
```
The next 7 days, today included. Events are the Calendar's own `CalEvent`
shape, filtered and colored by the person's calendar prefs
(`personalEventRules`, shared with `GET /calendar`); "family" includes every
active person's events, which then take the person's "others" color. Tasks are
only ever the person's own open general tasks (category OTHER), so the widget
can complete them with `POST /tasks/{id}/complete`.
An all-day event covering several days is listed once, on its first day in
view (v0.588.1); its `endDayISO` (exclusive) says how far it runs.
src/lib/queries/widget.ts.

### Bible reading — **built (v0.204)**
One aggregate read paints the whole Bible screen (mirrors src/app/bible/page.tsx
on a personal device): the family reading deck + coverage, and this person's own
coverage, plan, and hand-marked chapters. The family reading has **no completion
here** — like the web page, family completion is a BIBLE task on the dashboard,
not this screen. Writes go through a shared core (`lib/bible/personal-core.ts`),
the same one the web `"use server"` actions call.
```
GET  /api/v1/reading            the whole Bible screen
200: { "today":"YYYY-MM-DD",
       "family": {
         "havePlan": bool,
         "cards": [ { "iso":"YYYY-MM-DD","passage":"Acts 27-28","label":"Sunday, July 26, 2026" } ],
         "todayIndex": int,               // index of today's card (client centres it)
         "remaining": int,                // days left in the family plan
         "lastDayISO": "YYYY-MM-DD"|null, // when the plan runs out
         "stats": ReadingStats },
       "personal": {
         "color": "#0f5c63",              // this person's colour, for their bars/trophy
         "stats": ReadingStats,
         "plan": PersonalPlan|null,
         "readKeys": [ "Genesis|1", … ] } }
```
`ReadingStats` on the wire:
```
{ "totalChapters":1189, "readChapters":int, "wholeBible":bool,
  "ot": Group, "nt": Group,
  "groups": [ Group, … ] }               // Pentateuch … Revelation
Group = { "label":"Old Testament","chapters":int,"read":int,"percent":int }
```
`PersonalPlan` on the wire:
```
{ "id","name","remaining":int,
  "days": [ { "iso","label","passage","read":bool } ] }   // window −7 … +14 days
```

```
POST /api/v1/reading/plan          create (replacing) this person's plan
request: { "name","bookNames":[ "Genesis", … ],"startISO":"YYYY-MM-DD","chaptersPerDay":int }
200:     { "status":"ok" }
422:     validation   — no books, bad date, empty/over-long plan (message is shown)

POST /api/v1/reading/plan/delete   delete this person's plan (read chapters stay)
200:     { "status":"ok" }

POST /api/v1/reading/mark          tick/untick a day's reading
request: { "passage":"Acts 27-28","read":bool }   // read defaults true
200:     { "status":"ok" }         // marks exactly that passage's chapters. idempotent

POST /api/v1/reading/books         replace one book's read chapters (staged Save)
request: { "bookName":"Psalms","chapters":[ 1,2,3 ] }
200:     { "status":"ok" }

POST /api/v1/reading/books/bulk    mark/clear whole books (OT/NT read, clear)
request: { "bookNames":[ "Genesis", … ],"read":bool }
200:     { "status":"ok" }
```
Passages are addressed by body, not a `{ref}` path — they carry spaces and
dashes ("Acts 27-28"). This supersedes the earlier `POST /reading/{ref}/complete`
sketch.

### Workouts — **built** (day-level v0.186; detailed logging v0.191; reworked v0.537–0.579)
Day-level "did you work out / rest" — the lightweight path (no set-by-set
detail). Body `{ "date": "YYYY-MM-DD" }` optional, defaults today. All idempotent.
```
POST /api/v1/workouts/complete     mark the day worked out (placeholder session)
POST /api/v1/workouts/uncomplete   undo a quick "worked out" (empty sessions only)
POST /api/v1/workouts/rest         mark a rest day (excuses the workout task)
200: { "date", "status": "worked" | "pending" | "rest" }
```
Shares the exact web logic (src/lib/workouts/mark.ts).

**The day's plan to log.**
```
GET  /api/v1/workouts?date=YYYY-MM-DD
200: { "date", "loggable": bool,
       "workouts": [ TodayPlanned ],            // every planned workout that day (Core, Arms, …)
       "overdue":  [ { "date", "workouts":[TodayPlanned] } ],  // only when date is today
       "plannedWorkoutId","name","exercises",   // = workouts[0], for older clients
       "title":str,                             // "Chest · Legs" — blocks.ts dayTitle (v0.608)
       "strip":{ "today","days":[ { "date","task":str|null,"rested","logged" } ],
                 "overdue":[date] } }           // the last 8 days (v0.608)
TodayPlanned:    { "plannedWorkoutId","name","muscleGroup":str|null,
                   "category":str|null,         // WEIGHTS, HIIT… — decides the set logger (v0.608)
                   "exercises":[ PlannedMovement ],
                   "sessionLogged":bool }       // the plan's own session exists (v0.586)
PlannedMovement: { "poolExerciseId","name","metric","unit",
                   "value":num|null,            // what is logged for this day (prefill + "Edit")
                   "loggedAs":{ poolExerciseId,name }|null,   // swapped for the day
                   "stats": MovementStats|null, // WEIGHT movements with history only
                   "tracked":bool,              // false = listed, no number asked (v0.586)
                   "reps":int|null,             // reps logged with a WEIGHT value (v0.586)
                   "skipped":bool,              // skipped for this day (v0.586)
                   "setCount":int,              // sets logged for the day (v0.608)
                   "summary":str,               // "5 sets · top 185 × 1" (v0.608)
                   "last":str }                 // last time's sets, same words (v0.608)
```
`value`/`reps` are the day's top set (heaviest, then most reps), so an older
client reads a multi-set day as its top set.

**One movement's sets (every-set logging, v0.608).**
```
GET  /api/v1/workouts/sets?date=YYYY-MM-DD&slot=<planned poolExerciseId>[&doing=<swap id>]
200: { "sets":[ Set ], "loggedAs":{ poolExerciseId,name }|null,
       "last":{ "date","sets":[ Set ] }|null,   // hints; `doing` picks whose history
       "skipped":bool,
       "records":[ { "reps","weight","date" } ],  // best per rep count before this day (v0.610)
       "feedback":{ "effort","hurt" }|null,       // how it felt (v0.610)
       "target":{ "title","scheme",               // the planned scheme's targets (v0.611)
                  "sets":[ { "weight":num|null,"reps","top":bool } ] }|null,
       "suggestion": Suggestion|null,            // one card for this movement (v0.612)
       "recentTop":num|null }                    // heaviest in the last 14 days (big-jump note)
Set: { "weight":num|null, "reps":int|null, "seconds":int|null }

POST /api/v1/workouts/sets
request: { "date","plannedWorkoutId","slotId","loggedId",   // loggedId = a swap, else slotId
           "metric":"WEIGHT"|"REPS"|"DURATION","unit",
           "sets":[ Set ],                      // every saved set, in order; [] clears
           "completedOn":"YYYY-MM-DD"|null }    // set when logged late
200: { "date","status":"saved" }   404 not_found: the slot isn't in that plan
```
A replace, so the same call adds, edits and removes, and a queued offline copy
is safe to replay. One implementation: `logMovementSets` (src/lib/workouts/mark.ts).

**How it felt, and weekly training (v0.610).**
```
POST /api/v1/workouts/feedback
request: { "date","slot",                      // slot = the planned movement
           "effort":"EASY"|"SOLID"|"HARD"|"TOO_HARD"|null,
           "hurt":"NECK"|"SHOULDER"|"ELBOW"|"WRIST"|"UPPER_BACK"|"LOWER_BACK"|
                  "HIP"|"KNEE"|"ANKLE"|"OTHER"|null }
200: { "date","status":"saved" }              // the whole answer; both null clears

GET  /api/v1/workouts/weekly
200: { "weeks":[ { "start","days","sets","minutes","trained" } ],  // 12, oldest first
       "inARow":int }                          // records.ts weeksInARow
```
**Programs (v0.611).**
```
GET  /api/v1/workouts/programs
200: { "choices":[ ProgramChoice ], "active": ProgramInfo|null, "invite":bool }
ProgramChoice: { "key","name","blurb","weeks","defaultDays":[weekday],
                 "days":[ { "name","row":bool,
                            "roles":[ { "key","label","muscleGroup","main","optional","scheme",
                                        "defaultId"|null,"options":[ {id,name} ] } ] } ] }
ProgramInfo:   { "key","name","week","weeks","label","intent":"LIGHT"|"TEST"|null,
                 "blockDone":bool,"maxes":[ { "poolExerciseId","name","weight" } ] }

POST /api/v1/workouts/programs/start  { "key","days":[weekday per program day],
                                        "picks":{ "<day>:<slot>": poolExerciseId|null },
                                        "tops":{ poolExerciseId: recent top weight } }
POST /api/v1/workouts/programs/end    { "restore":bool }   // true: back to the old plan
POST /api/v1/workouts/programs/block  { "raise":bool }     // end of a block
POST /api/v1/workouts/programs/max    { "poolExerciseId","weight" }   // 0 clears
POST /api/v1/workouts/invite          { "answer":"later"|"never" }
200 (each): { "status":"ok" }
```
Starting writes the caller's weekly plan (`PlannedWorkout` rows with each
movement's `scheme`) and keeps the old plan to restore. `GET /api/v1/workouts`
also returns `program` (ProgramInfo for that day, or null). Progress points
carry `intent` ("LIGHT"/"TEST"), drawn hollow. Rules:
src/lib/workouts/programs.ts (`targetsFor`); running a program:
src/lib/workouts/program-run.ts.

**Suggestions (v0.612).**
```
Suggestion: { "key","title","why","actions":[ { "answer","label" } ],"weight":num? }
POST /api/v1/workouts/suggestion  { "date","key","slot"?,"answer" }  → { "date","status":"saved" }
```
`GET /api/v1/workouts` returns the day's `suggestion` and `light` (0.8 / 0.9 when
the day was made lighter, else null). Answering hides a card for the day;
"light" and "ease" also make the day lighter, and the loggers' `target` then
comes back at that share. A set more than 10% over `recentTop` is flagged on
each client (`bigJump`). Rules and thresholds: src/lib/workouts/suggest.ts.

New bests and the record chips are worked out on each client from `records`
with the rules in src/lib/workouts/records.ts (`isNewBest`, `recordChips`).

```
MovementStats (src/lib/queries/movement-stats.ts — the history block, v0.568–0.570):
  { bestWeight, bestWeightReps, bestOn,          // heaviest ever (weight only)
    bestReps, bestRepsWeight, bestRepsOn,        // most reps ever, at the weight done
    lastWeight, lastReps, lastOn }               // the latest session, even below both
```
Exact shapes: `TodayPlanned` / `PlannedMovement` / `OverdueWorkoutDay` in
src/lib/queries/workout-log.ts.

**Logging.**
```
POST /api/v1/workouts/log
request: { "date":"YYYY-MM-DD",              // the day the workout was DUE
           "completedOn"?:"YYYY-MM-DD",      // the day it was actually done (v0.564)
           "plannedWorkoutId",
           "entries":[ { "poolExerciseId","metric","value":num,"unit",
                         "reps"?:int,         // on a WEIGHT entry: the set's reps (v0.537)
                         "swappedFrom"?:id } ],   // the planned movement this stood in for
           "replace"?:bool, "detectConflict"?:bool }
200: { "date", "status":"worked" }  |  { "date", "status":"conflict", "conflict":{…} }
```
- **One implementation**: the web's logging calls the same `logPlannedWorkout`
  (src/lib/workouts/mark.ts) — the web had its own copy until v0.566 and it had
  drifted (reps dropped, "Edit weight" creating a second session).
- A log replaces only the movements it sends (v0.539), so per-movement logging
  (v0.579 — each movement has its own Log button) never touches the others.
- `completedOn`: an overdue workout counts for its due day (adherence) but is
  shown on the day it was done (grid, charts, Recent workouts). An older client
  omits it and behaves as before.
- metric is WEIGHT / REPS / DISTANCE / METERS / DURATION; a held movement in a
  weights plan logs DURATION in seconds (entered as minutes:seconds, v0.546).
- `detectConflict` reports a conflict only when a movement being sent already
  has a set that day (v0.586); before, any session for the plan counted.
- An empty `entries` deletes nothing (v0.586). It used to clear the plan's
  whole session, so a Log tapped with a blank box wiped the other movements.

**An additional (unplanned) workout.**
```
POST /api/v1/workouts/log-custom
request: { "date"?:"YYYY-MM-DD", "metric", "value":num, "unit"?,
           "poolExerciseId"? | "hiitWorkoutId"? | "category"?,
           "load"?:num,                      // a carried load (rucking)
           "reps"?:int,                      // on a WEIGHT log (v0.587)
           "notes"?, "replace"?:bool, "detectConflict"?:bool }
200: { "date", "status":"worked" }  |  { "date", "status":"conflict", "conflict":{…} }
```
One implementation, `logCustomEntry` (src/lib/workouts/mark.ts); the web's
`logCustomWorkout` delegates to it since v0.587.

**Skipping one movement (v0.586).**
```
POST /api/v1/workouts/skip
request: { "date":"YYYY-MM-DD", "plannedWorkoutId",
           "poolExerciseId":id|"",           // "" = the plan as one result (HIIT)
           "skipped":bool }
200: { "date", "skipped":bool }   404 when the plan isn't the caller's
```
**When the day's workout is complete (v0.586).** Every planned movement the
plan asks a number for is logged or skipped (`planDone`), and something was
logged → COMPLETE. Everything skipped, nothing logged → SKIPPED (excused).
Otherwise PENDING — unless something unplanned was logged that day (a custom
log, a sport, "I worked out"), which completes it as it always did. A rest day
is never overridden; a log never reopens a day closed as SKIPPED, only a skip
change does. One rule, `settleWorkoutTask` in src/lib/workouts/mark.ts, run
after every planned log, HIIT log and skip. Logging a movement un-skips it.

**Progress (body map, charts).**
```
GET  /api/v1/workouts/progress   → WorkoutProgress (src/lib/queries/workout-log.ts)
  series[]: { poolExerciseId,name,muscleGroup,tracked,unit,
              points:[{date,value,reps,intent}], best, repMaxes,
              bands:[{key,label,points}],          // one rep range per line (v0.610)
              navRegion, shadePrimary, shadeSecondary[], view }   // body map, v0.549–0.551
  planDays[]: { day, groups[] }   defaultGroup   defaultId   history[] …
```
Read from logged history, not only the plan (v0.547), so a rotation or no plan
still shows what was lifted. The involvement table that decides `navRegion` and
shading stays on the server (src/lib/workouts/involvement.ts) — the phone draws
what it is sent rather than keeping a second table.

### Companions (collectible creatures)
```
GET  /api/v1/characters/collection   this person's gallery: every creature by era,
                                     owned (name, art, stage, isActive, shiny) or a
                                     mystery (rarity only). Self only.
POST /api/v1/characters/hatch        { "mode":"new"|"deepen" } → { "hatched": … | null }
POST /api/v1/characters/activate     { "species" } → { "activated": name }   (v0.576)
POST /api/v1/me/avatar/companion     { "species", "stage":0|1|2 } → { "person": Person }   (v0.582)
GET  /api/v1/companion-sprite        sprite art
```
Progression (v0.574–0.578), settled after three bugs from conflating them:
**`stage` is earned growth (hatchling → juvenile → adult); `phase` is what the
companion is doing now. Nothing about one may be inferred from the other** —
shiny does not mean adult. An egg appears only once the active companion is
fully grown; deepening is a phase worked through after that. Activating an
older companion banks the current one's growth and resumes the returning one's
(`companions-tenure.ts`, migration 121). There is no monthly hatch cap.

**Growth and the month (v0.603, rules in docs/SCORING.md).** Each day is worth
the share of its effort finished (0..1, today live). `GET /api/v1/characters`
companion adds `pendingFrom` (squares from here on are today's — draw lighter)
and `growthLabel` ("7.4 / 12" while growing or deepening, else null); `xpCells`
are coloured by what earned the growth. The sheet adds
`"month": { "credit": 17.4, "target": 15 }` — days of work this month against
the family goal. `season` (tier) is still sent for older apps but no longer
drawn. `GET /api/v1/coop` children add `credit` (1 decimal); `cleanDays` is now
`floor(credit)` for older apps. `GET /api/v1/scoring/guide` →
`{ "sections": [{ "title", "lines": [string] }] }`, the "How scoring works" text
with live numbers (same as web `/scoring`).

**Companion as profile picture (v0.582, phone only).** Each owned gallery entry
carries `stageImages` — sprite URLs for the stages reached so far (index =
stage; unreached stages are absent, so their art is never sent). Choosing one
posts `{ species, stage }`; the server re-checks with `loadOwnedCompanions`
(src/lib/companions-owned.ts — the same rule the gallery's `stage` comes from)
that you own it and have reached that stage, stores `companion:<species>:<stage
name>` in `avatarPath`, deletes a replaced uploaded photo, and returns the
person. The person object gains:
```
"avatarCompanion": { "species", "stage":0|1|2, "image":"/api/v1/companion-sprite?p=…" } | null
```
Draw it whole (fit, not crop; no `avatarPosition`). `avatarUrl`/`avatarIcon` are
null when it is set, so an older app shows initials.

### Devices — **built (v0.189)**
This person's own devices, so anyone can see what's enrolled and revoke a phone
they don't recognise without the admin panel. On enrollment the person is
emailed a "new device added" alert (when SMTP is configured and they have an
email) — the tripwire for an unexpected enrollment.
```
GET  /api/v1/devices               this person's devices
200: { "devices": [
        { "id","name": string|null,
          "enrolledAt": ISO, "lastSeenAt": ISO|null,
          "status": "active" | "expired" | "revoked",
          "current": bool } ] }     // current = the calling device

POST /api/v1/devices/{id}/revoke   revoke one of your own devices
200: { "id", "revoked": true }
403: forbidden   — not your device
404: not_found
```

### Push & notifications — proposal
```
POST   /api/v1/devices/push        register FCM push token for this device
DELETE /api/v1/devices/push        drop this device's push token
GET    /api/v1/notifications       recent notifications for deep-linking
```

### Sync
```
GET  /api/v1/sync?since=<cursor>   changes since cursor, for offline reconcile
```
Cursor-based, additive. Offline writes replay through the same POSTs above, so
there is no separate write-sync path to keep consistent.

### Meta — **built (v0.177)**
```
GET  /api/v1/meta               { "apiVersion": 1, "appVersion": "0.177.0", "minClient": 0 }
```
No auth. The handshake a fresh install uses to decide whether it can talk to
this server. `minClient` is the lowest client build this server still accepts
(0 = any); raise it to force old apps to update.

---

### School — student view — **built; `complete` + `needsAttendance` added v0.448**

`GET /api/v1/school` returns each person's school work for today. Two fields the
app's completion UI depends on (app 0.252 needs server 0.448 — deploy both):

- **`complete`** — per work item, a boolean: whether that assignment is marked
  done. Drives the green check in front of a completed item in the student's
  Today list. A completed item still appears (it isn't filtered out) so the list
  shows done-vs-still-due at a glance.
- **`needsAttendance`** — per person, a boolean derived from
  `pendingClassPrompts(today)`: an after-class "did you attend?" check-in is still
  open. While this is true the client holds off on "Complete for today!" even if
  every assignment is done, so the check-in isn't skipped.

"Complete for today!" is shown only when everything still *due today* is done
(it counts what's left, not the day's total) and no attendance prompt is pending.

### Game time — ingest (collector → server) — **built**

`POST /api/v1/game-time/ingest`. This is **not** a mobile endpoint — it's the
service contract for the standalone game-time collector
(`thorin29/kairos-game-collector`), which owns all Xbox/Steam integration and
sends Kairos only resolved numbers. Documented here because the collector depends
on this shape.

- **Auth:** a shared service secret in `GAMETIME_INGEST_TOKEN`, sent as
  `X-Ingest-Token: <token>` (or `Authorization: Bearer <token>`). This is the only
  external-ingest auth in the app — not a device/person session.
- **Body:** per-person **daily rollups** the collector has already resolved
  (Steam-primary merge applied):

```jsonc
{
  "days": [
    {
      "friend": "P1",              // matched by gamertag -> steamId -> name
      "gamertag": "gamer_tag",   // optional
      "steamId": "765...",            // optional
      "date": "2026-09-19",
      "minutes": 143,
      "games": [ { "game": "Grounded", "minutes": 143, "platform": "Windows" } ],
      "platforms": ["steam"],         // per-system icons = merge winners
      "status": { "gamerscore": 1240, "gamerpic": "https://...",
                  "hasGamePass": true, "msBalance": "$12.50" }
    }
  ]
}
```

- **Storage:** upserts `GameDay` (the day's `minutes`), **replaces** the whole
  `GameDayTitle` breakdown for that day (so a corrected push clears stale games),
  and upserts the person's `PlayerCard` (status + platforms).
- **Idempotent:** re-sending "today so far" repeatedly never accumulates. The
  collector includes in-progress sessions, so a still-playing kid shows current
  time.
- **Response:** `{ "matched": [...names], "unmatched": [...] }`. An entry that
  resolves to no Kairos person comes back as `unmatched`.

### Hockey — **built (v0.600)**

`GET /api/v1/hockey` (device auth). Kairos asks the ice-time container for the
week on every call; nothing is stored. Shaped by `buildHockeyView`, the same rule
the web page uses.

```jsonc
// Not set up:            { "state": "off" }
// ice-time unreachable:  { "state": "error", "error": "Couldn't reach ice-time…" }
{
  "state": "ok",
  "eventTypeId": "…",             // the "Hockey practice" type, or null
  "days": ["2026-10-26", …],      // 7 days, today first
  "rinks": ["Sample Arena"],
  "generatedAt": "…", "checkedAt": "…",   // checkedAt: oldest schedule's last read
  "warnings": [],
  "sections": [
    {
      "name": "Drop-in", "colA": "Skaters", "colB": "Goalies",   // colA "Signed up", colB null when unsplit
      "link": "https://…", "rink": "Sample Arena",
      "rows": [
        {
          "date": "2026-10-27", "start": "06:00", "end": "07:45", "endDayOffset": 0,
          "minutes": 105, "rink": "Sample Arena",
          "skaters": { "enrolled": 1, "max": 24, "remaining": 23 },
          "goalies": { "enrolled": 0, "max": 3, "remaining": 3 },
          "players": null,
          "link": "https://…",
          "add": { "title": "Drop-in: Sample Arena", "label": "Add goalie session",
                   "location": "1 Example Way" }   // location null when no saved address matches
        }
      ]
    }
  ]
}
```

Rows are local wall-clock times. A section with no rows this week is still listed.

**Layout (v0.601):** sections come in this person's order, each with
`"open": true|false` (everything starts collapsed). Save it with
`POST /api/v1/hockey/prefs` `{ "order": [names], "open": [names] }` — the whole
layout each time; returns `{ "ok": true, "order": [...], "open": [...] }`. The
phone's layout is the person's own; the web on a shared device keeps a separate
household layout (v0.602.2).

## Endpoint inventory (what exists vs what is written up here)

The sections above describe the surfaces in detail. The server currently exposes
**153 route files** under `src/app/api/v1/`, and the detailed sections cover the
ones a client needs to reason about; the rest are thin verbs over the same models
(a single-purpose POST that takes an id and returns `{ "status":"ok" }`).
Authoritative list — `find src/app/api/v1 -name route.ts`. Groups, so nothing is
silently invisible:

- **auth/** `login`, `join`, `join/check`, `forgot`, `recover`, `reauth`, `refresh`, `revoke`, `password` (change your own: `{ current, next }` → `{ ok, error? }`; v0.605) · **meta**, **me**, `me/avatar`, `me/avatar/companion`, `me/color`, `me/birthday`, **devices**, `devices/[id]/revoke`, `avatars/[file]`
- **dashboard**, **tasks** (`add`, `[id]/complete`, `[id]/uncomplete`, `[id]/update`, `[id]/edit-data`, `[id]/delete`), **chores** (`always-open`, `claim`, `claim-complete`, `release`)
- **calendar** (`event`, `event/update`, `event/delete`, `prefs`, `subscribed-reminders`), **event-names**, **event-bg**, **addresses**, **sport/confirm**, **sport/decline**, **notifications/meta**, **notifications/upcoming**
- **school** (`add`, `add-to-today`, `approvals`, `rename`, `delete`), **classes**, **classes/form**
- **reading** (`books`, `books/bulk`, `mark`, `plan`, `plan/preview`, `plan/delete`), **books** (`add`, `update`, `delete`, `finish`, `log`, `shelf`, `goals`), **settings/reading-reminder**
- **groceries** (`add`, `add-catalog`, `move`, `purchased`, `quantity`, `remove`, `trip/start`, `trip/complete`)
- **money** (`entry`, `update`, `delete`, `approve`, `approve-all`, `unapprove`, `starting`, `rewards/approve-base`, `rewards/approve-month`)
- **workouts** — the largest group: `week`, `browse`, `builder`, `progress`, `pool`, `rest`, `skip`, `expire`, `log`, `log-custom`, `sets`, `feedback`, `weekly`, `programs*` (incl. `start`, `end`, `block`, `max`), `invite`, `suggestion`, `complete`, `uncomplete`, `movement*`, `personal*` (incl. `personal/share`), `plan*` (incl. `plan/active`, `plan/options` (each exercise carries `metric`, its own "Logs as" or null; v0.609), `plan/copy`, `plan/start`, `plan/rest`, `plan/add-hiit`, `plan/add-pool`, `plan/[id]/remove`), `rotation*` (incl. `anchor`, `add-slot`, `move-slot`, `remove-slot`, `rest-days`, `start`, `stop`), `sessions/[id]/delete`
- **characters** (`collection`, `hatch`, `activate`), **companion-sprite**, **coop** (`propose`, `vote`, `select`, `grant`, `remove`)
- **game-time**, **game-time/ingest** (collector → server), **scoring/guide**, **nav** (drawer sections to hide, v0.604)
- **hockey** (the week from ice-time), `hockey/prefs`
- **widget** (the Android home-screen widget's feed)

## Deep links (notification -> screen)

Notifications carry a typed target so a tap opens the right screen:
`chore:<id>`, `reward:<id>`, `event:<id>`, `reading:<ref>`. The client resolves
these against the endpoints above.

## What this contract deliberately excludes from v1

Admin/editor surfaces (creating chores, editing plans, SMTP, device settings)
stay web-only for now. The phone is a *personal client* — it completes and
views; it does not administer. Parent-facing management can be a later,
separate contract if wanted, and would reuse this auth layer.

---

## Open questions

1. ~~Identity shape~~ — **closed (v0.177): per-person device tokens (option 1).**
2. ~~Enrollment UX~~ — **closed, then revised (v0.299): enrollment is a single
   invitation code entered in the app (`/auth/join`), which sets/confirms a
   password and enrols in one step.** The earlier per-person enrollment code + QR
   (`/auth/enroll`) was retired.
3. ~~Token lifetime~~ — **closed: invitation code single-use and short-lived;
   device token 365 days, rotated by `/auth/refresh` (client refreshes before
   expiry).**
4. ~~Admin management surface~~ — **closed (v0.179, revised v0.299): a per-person
   "Phone app" panel on the household page lists and revokes that person's
   enrolled devices.** Enrolling a new phone is done from the invite / "Add a
   phone" buttons, which issue an invitation code the app redeems at `/auth/join`.
   Broader parent-facing management (creating chores etc.) stays web-only for v1.
5. Offline scope: which screens must work with no network (likely today's
   chores + completion), which can require it. Still open.
