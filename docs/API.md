# Kairos API (v1) — mobile client contract

Status: **draft / proposal.** Nothing here is built yet. This document is the
contract the native Android client and the Next.js backend will both hold to,
so the client is never coupled to Next.js implementation details. It is worth
having even if the app is never built, because it forces the boundary to be
explicit.

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

This is the decision to make before any Kotlin is written. Three shapes:

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

**Recommendation: option 1.** It preserves the household model, requires no new
password surface, and keeps the web app unchanged. The rest of this contract
assumes option 1; if a different option is chosen, the `/auth` and `/me`
sections change and little else does.

Until this is settled and a token surface exists, the Authelia `/api` bypass
must NOT be added — that is a standing decision (see DECISIONS.md).

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

### Auth & identity
```
POST /api/v1/auth/enroll        redeem an enrollment code -> device token + person
POST /api/v1/auth/refresh       rotate device token
POST /api/v1/auth/revoke        revoke this device
GET  /api/v1/me                 the enrolled person: id, name, avatar, role
```

### Dashboard (one call to paint the home screen)
```
GET  /api/v1/dashboard          today for this person: chores due, points,
                                streak, next calendar items, reading due
```
One aggregated read so the phone paints in a single round trip; the fields are
derived server-side.

### Chores
```
GET  /api/v1/chores             this person's chores (query: ?date=YYYY-MM-DD)
POST /api/v1/chores/{id}/complete
POST /api/v1/chores/{id}/uncomplete
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

### Workouts
```
GET  /api/v1/workouts           today's planned workout for this person
POST /api/v1/workouts/{id}/complete
```

### Companions (collectible creatures)
```
GET  /api/v1/companions         this person's roster
```

### Devices & notifications
```
POST /api/v1/devices            register FCM push token for this device
DELETE /api/v1/devices          drop this device's push token
GET  /api/v1/notifications      recent notifications for deep-linking
```

### Sync
```
GET  /api/v1/sync?since=<cursor>   changes since cursor, for offline reconcile
```
Cursor-based, additive. Offline writes replay through the same POSTs above, so
there is no separate write-sync path to keep consistent.

### Meta
```
GET  /api/v1/meta               apiVersion, appVersion, minClient
```

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

## Open questions to close before Kotlin

1. Identity shape (section above) — the gating decision.
2. Enrollment UX: QR from the admin area vs short numeric code.
3. Token lifetime and refresh cadence for device tokens.
4. Whether parents get a management surface in v1 or web-only.
5. Offline scope: which screens must work with no network (likely today's
   chores + completion), which can require it.
