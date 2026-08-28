# Decisions

Standing decisions for Kairos: the choices that are settled, and why, so they
aren't relitigated and so any tool or person working on the repo can see the
reasoning without reconstructing it from old conversations. ARCHITECTURE.md
covers *how the system is built*; this file covers *what was decided and why*,
especially security and product-shape calls.

**Update discipline.** This file is updated in the same commit as any change
that makes, reverses, or narrows a standing decision — the same way
`src/lib/version.ts` and ROADMAP.md are touched every release. If a release
changes a security posture, an auth boundary, a scoring rule, or the mobile
contract, it adds or edits an entry here. Entries are append-mostly: when a
decision changes, the old entry is marked superseded rather than deleted, so
the history stays legible.

Format: newest first. Each entry has a date, a short title, the decision, and
the reason.

---

## 2026-08 — Native Kotlin for Android, not Capacitor
**Decision:** the Android client will be native Kotlin/Jetpack Compose, not a
Capacitor wrapper around the web UI.
**Reason:** with development driven by prompts rather than hand-coding, the
limiting cost is maintenance surface and rebuild risk, not typing. The web UI
is near feature-stable and the mobile surface is bounded, so building the native
UI once beats building a Capacitor UI now and a native one later. Native also
gives a cleaner path to notifications, background work, and widgets. The web
React app is unchanged; Android becomes a new client on a shared API.

## 2026-08 — A versioned REST API is the mobile boundary
**Decision:** the mobile client talks to `/api/v1` (see docs/API.md), not to
Server Actions. The web app keeps using Server Actions. Business logic stays on
the server, called by both doors.
**Reason:** decouples the client from Next.js internals, makes the contract
explicit, and is valuable even if the app is never built. Additive-only within
a major version.

## 2026-08 — Mobile identity is per-person device tokens (proposed)
**Decision (proposed, not yet built):** enrollment binds a device to a Person;
the device token is the identity; no password login on the phone. Parents
enroll devices from the admin area.
**Reason:** preserves the household model (no per-person passwords), keeps the
web app identity-free, and still lets a phone open to just that person. See
docs/API.md "identity" for the alternatives considered. **This is the gating
decision for mobile and must be confirmed before Kotlin begins.**

## 2026-08 — Authelia `/api` bypass stays off until app-auth exists
**Decision:** do not add an Authelia bypass for `/api` until the token-based
app authentication surface is actually built.
**Reason:** an unauthenticated `/api` behind a lifted Authelia gate would be a
public hole. The bypass and the token surface ship together, never apart.

## 2026-08 — Public exposure requires env enforcement, not the in-app toggle
**Decision:** for a public deployment, `REQUIRE_LOGIN=true` and `SESSION_SECRET`
must be set as container env vars. The in-app "Require sign-in" DB toggle alone
does not secure a public site.
**Reason:** middleware runs at the edge and cannot read the database, so
soft-navigation can bypass a DB-only flag. Env enforcement is checked on every
request. The Device settings page shows the green "Edge enforcement is on"
banner only when both env vars are present. (v0.172–0.176.)

## 2026-08 — Admin unlock is enforced at the edge, 4-hour TTL
**Decision:** the signed admin-unlock cookie is verified in middleware on every
`/admin` navigation; TTL is 4 hours.
**Reason:** a lapsed unlock must stop reads immediately, not linger until the
next hard reload. A true inactivity auto-lock is still open (ROADMAP). (v0.176.)

## 2026-08 — Admin PIN is internal convenience; Authelia is the front door
**Decision:** the 4-digit admin PIN is a low-friction internal lock, not the
public security boundary. Authelia in front of the whole domain is the real
front door.
**Reason:** the PIN stops a kid at the shared tablet; it is not meant to resist
a determined remote attacker, which is Authelia's job.

## 2026-08 — Config lives in the container template, not a file
**Decision:** real runtime config lives in Unraid container-template env vars.
No `.env` on the server; `.env.example` is documentation only.
**Reason:** single source of truth for deployment; avoids a stray file drifting
from the actual running config.

---

## Product-shape decisions (from ARCHITECTURE.md, restated for the log)

- **No per-person sign-in on the web dashboard.** It is a shared household
  screen; the only lock is the admin PIN. (The mobile app is the first place
  per-person identity enters — see above.)
- **Derive at read time, never store computed values.** Scores, streaks, and
  expiry are computed from source rows, not persisted, to avoid backfills and
  keep logic centralized.
- **Levels never drop; no punishments; money rewards are cosmetic.**
- **Vacation pauses leave the scoring denominator** (not counted as misses);
  **rotation rest days pause the cycle** rather than consuming a slot.
- **School work stays out of scoring** until the scoring rework epic ships.
- **Idempotent migrations always** (`ADD COLUMN IF NOT EXISTS`, guarded
  `CREATE TYPE`, guarded FK creation).
