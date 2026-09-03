# Kairos API (v1) — mobile client contract

Status: **partly built.** The identity model is settled (per-person device
tokens) and the auth/identity surface is implemented as of v0.177:
`POST /auth/enroll`, `POST /auth/refresh`, `POST /auth/revoke`, `GET /me`, and
`GET /meta`. Everything else below remains a **proposal** until built. This
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

As built: a parent generates a one-time **enrollment code** for a person in the
admin area; the phone redeems it at `/auth/enroll` for a long-lived **device
token** (a bearer token). Only a SHA-256 of each secret is stored — enrollment
codes and device tokens alike — so a database leak yields nothing usable. The
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
- Auth: `Authorization: Bearer <device-token>` on every request except
  `/auth/enroll`.
- The client sends only inputs; the server derives everything else and rebuilds
  computed state on arrival (ARCHITECTURE.md, "Derived state is computed, not
  stored"). The client never sends a score, a streak, or an expiry it computed.

## Errors

Uniform envelope, so the client has one error path:

```
{ "error": { "code": "forbidden", "message": "human readable" } }
```

Codes: `unauthenticated`, `forbidden`, `not_found`, `rate_limited`,
`validation`, `conflict`, `server`. HTTP status mirrors the code. `validation`
carries a `fields` map. Never leak stack traces or which of identifier/secret
was wrong (matches the existing login behaviour).

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

### Auth & identity — **built (v0.177, login added v0.187)**

```
POST /api/v1/auth/login         verify username/password -> short-lived login proof
POST /api/v1/auth/enroll        redeem an enrollment code (+ proof) -> device token + person
POST /api/v1/auth/refresh       rotate this device's token
POST /api/v1/auth/revoke        revoke (sign out) this device
GET  /api/v1/me                 the enrolled person
```

**The layered model (DECISIONS.md):** a person with a password enrolls with
**login + code** — sign in for a login proof, then redeem a device code, both for
the same person. A **passwordless account (a child)** enrolls by **code alone**,
generated by a parent in the admin panel. So a leaked password can't enrol a new
device (needs an admin code), and a leaked code can't become a password-holder
(needs the password).

**`POST /auth/login`** — no bearer. Rate-limited per source. Returns a proof to
hand to `/auth/enroll`; never says which of identifier/password was wrong.
```
request:  { "identifier": "ellie or ellie@…", "password": "…" }
200:      { "loginToken": "<proof>", "person": { …see /me… } }
401:      unauthenticated — wrong username or password
422:      validation      — identifier/password missing
429:      rate_limited
```

**`POST /auth/enroll`** — no bearer. Public by design (a phone anywhere),
protected by the code's short life, single use, and per-source rate limiting.
`loginToken` is required when the code's account has a password; omit it for a
passwordless child.
```
request:  { "code": "ABCD-EF23", "deviceName": "Ellie's Pixel",   // deviceName optional
            "loginToken": "<proof>" }                              // required iff account has a password
200:      { "token": "<device-token>",
            "expiresAt": "2027-08-28T00:00:00.000Z",
            "person": { …see /me… } }
422:      validation      — code missing
401:      unauthenticated — account has a password and no valid proof (sign in first)
403:      forbidden       — code invalid or expired (never says which)
429:      rate_limited
```
The `code` is case-insensitive and the dash is optional. The `token` goes in
`Authorization: Bearer <token>` on every later request; store it in the OS
keystore.

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
Clients treat `reauth_required` differently from `unauthenticated`: keep the
device token, show a password prompt, call `/auth/reauth`. Only a plain
`unauthenticated` (bad/expired/revoked token) means re-enroll from scratch.

**`GET /me`** — bearer required. The person this device is enrolled to.
```
200:      { "id": "clx…",
            "name": "Ellie",            // display name if set, else short name
            "shortName": "ellie",       // the unique dashboard handle
            "avatarUrl": "/api/avatars/…" | null,   // relative to the API base
            "avatarIcon": "🦊" | null,               // emoji when an icon was picked
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
       "groups":  [ { "category":"CHORE","label":"Chores","items":[ Task, … ] } ] }
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

### Chores (further chore-specific surface — proposal)
```
GET  /api/v1/chores/pool        claimable pool chores
POST /api/v1/chores/pool/{id}/claim
```

### Points & rewards (money ledger)
```
GET  /api/v1/rewards            catalogue + this person's balance
POST /api/v1/rewards/{id}/redeem
GET  /api/v1/ledger             this person's transactions
```

### Calendar
```
GET  /api/v1/calendar           events in a window (?from=&to=), person-filtered
```

### Bible reading
```
GET  /api/v1/reading            today's assigned reading + coverage stats
POST /api/v1/reading/{ref}/complete
```

### Workouts — **built (v0.186, phase 1: day-level)**
Day-level "did you work out / rest" — the lightweight path (no set-by-set
detail). Body `{ "date": "YYYY-MM-DD" }` optional, defaults today. All idempotent.
```
POST /api/v1/workouts/complete     mark the day worked out (placeholder session)
POST /api/v1/workouts/uncomplete   undo a quick "worked out" (empty sessions only)
POST /api/v1/workouts/rest         mark a rest day (excuses the workout task)
200: { "date", "status": "worked" | "pending" | "rest" }
```
Shares the exact web logic (src/lib/workouts/mark.ts).

**Detailed logging — built (v0.190, phase 1: weight × reps).**
```
GET  /api/v1/workouts?date=YYYY-MM-DD    the day's scheduled exercises to log
200: { "date", "loggable": bool,
       "exercises": [ { "exerciseId","name","unit","metric",
                        "logged": { "weight": num|null, "reps": num|null } | null } ] }

POST /api/v1/workouts/log                log weight × reps and complete the workout
request: { "date", "entries": [ { "exerciseId","weight": num|null,"reps": num|null } ], "notes"?: str }
200:     { "date", "status": "worked" }
```
`loggable` is false when nothing per-exercise is scheduled that day — the client
falls back to the day-level actions above. Only the caller's own exercises are
accepted; unknown ids are ignored. Records one summary set (setNumber 1) per
exercise, mirroring the web scheduled-lift prompt. Non-weight metrics, multi-set,
HIIT, and custom workouts are later phases.

### Companions (collectible creatures)
```
GET  /api/v1/companions         this person's roster
```

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
2. ~~Enrollment UX~~ — **closed: one code, shown as both a short 8-char code
   (`ABCD-EF23`, look-alike-free alphabet) and a QR of the same string.** Manual
   entry and scan hit the same `/auth/enroll`.
3. ~~Token lifetime~~ — **closed: enrollment code 15 min, single use; device
   token 365 days, rotated by `/auth/refresh` (client refreshes before expiry).**
4. ~~Admin management surface~~ — **closed (v0.179): a per-person "Phone app"
   panel on the household page generates a one-time code (short code + QR) and
   lists / revokes that person's devices.** The QR encodes the raw enrollment
   code string, so the app's scanner reads it and posts it straight to
   `/auth/enroll`. Broader parent-facing management (creating chores etc.) stays
   web-only for v1.
5. Offline scope: which screens must work with no network (likely today's
   chores + completion), which can require it. Still open.
