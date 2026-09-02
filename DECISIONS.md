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

## 2026-09 — No function props from Server to Client Components
A Client Component (`"use client"`) must only receive serialisable props from a
Server Component. Passing a function — e.g. an `hrefFor(iso)` builder or an
event handler — compiles and even builds cleanly, then throws at render:
"Functions cannot be passed directly to Client Components." Instead, pass the
plain data the client needs and build the value inside the client (e.g. pass the
current `view` string and construct `/calendar?view=…&date=…` there). Server
Components may still pass functions to other Server Components, which is why the
shared tablet calendar's `hrefForDay` into `MonthGrid`/`MiniMonth` is fine.

Reason: this class of bug is invisible to both the local typecheck and the
Docker build (it's a runtime serialisation error), so it only surfaces when the
page actually renders. It bit the calendar month-dropdown once; worth keeping in
mind especially as the Kotlin app adds more client/server boundaries.

## 2026-09 — Sport events are never auto-counted; they always ask
Calendar events that count as a sport workout — whether flagged on the event
type or coming from a subscribed feed marked "counts as a sport workout" — no
longer log a workout on their own. They surface a "did you do it?" prompt on the
dashboard, and only become a logged SPORT session when the person confirms (a
decline is remembered per person per occurrence). The old auto-logger
(`autoLogSportFeeds`) is removed.

Reason: auto-counting was both wrong and confusing. It credited a workout the
person may not have done, and it dated events off the raw UTC timestamp, so an
evening game slid onto the next day and could land in the wrong week. The prompt
path already dates each occurrence in the household timezone and only counts on
confirmation, so routing subscribed feeds through it fixes the day/week
attribution and the false "completed" at once. "This week" on the activity card
is the calendar week (Sunday–Saturday). Note: any SPORT sessions the old
auto-logger already wrote stay in the data until cleared by hand.

## 2026-08 — Personal calendar: per-user preferences, colour precedence, native-first gestures (planned)
Records the design agreed before building, so the plan survives across sessions.
The signed-in ("personal") calendar becomes per-person; the shared wall tablet
is untouched and keeps the household-wide settings. Built on the **web personal
view first**, then the Kotlin app renders the same model.

**Storage:** a new per-user `UserCalendarPref` (server-side, so a phone and the
web personal view always agree and a new device inherits the prefs). Holds:
default view; `othersMode`; per-kind / per-EventType / holiday / subscription
colour overrides; a `personalizeColours` master toggle; now-line override; shown
people; checked subscriptions; `showFamily` (default off); `showSchoolWork`
(default on).

**Two enums, not to be confused:** calendar events use `EventKind`
(CLASS/WORK/APPOINTMENT/BIRTHDAY/EXTERNAL/OTHER) plus admin `EventType` custom
types; tasks use `Category`. Personalisation is by event kind/type — a **new
colour axis**, since events are currently coloured by owner (person) and the
only category colouring today is for tasks.

**Others-mode** (how *other people's* items look to me): `OWN` (their profile
colour) / `GREY` (one colour, default grey, personalisable) / `FAMILY` (tablet
parity — the household scheme, for admins who want to see everyone as the
tablet does).

**Colour precedence for a personal viewer:**
1. `othersMode = FAMILY` → use the exact shared-tablet precedence
   (EventType.colour → family colour → owner colour, with bands/blend for
   shared events). Admin parity.
2. Item is someone else's **and** `othersMode = GREY` → grey / chosen colour.
3. Otherwise (mine, or `OWN`): my kind/type override if personalisation is on →
   else the system default (EventType.colour → owner colour → family). Holidays
   and subscriptions follow the same "my override else system" rule.

**Personalisable set:** Appointment, Class, Work, Birthday, each custom
EventType, holidays, subscriptions. **School work follows the Class colour** (no
separate row). `OTHER` stays system. **Vacations** stay admin-only on the family
colour scheme and are never user-recoloured. The now-line ("hour line") is
admin-set but a personal user may override it.

**Defaults on first open:** personal (family filter off), school work on,
others shown in their own colour, personalisation off (everything follows
system) until the user turns it on.

**Phasing:** A structure (model + right-side options drawer + all five views,
adding 3-day and agenda + persistent filters) → B colours (overrides +
others-mode + now-line) → C month-name mini-month dropdown + polish (clean menus,
**no explanatory text**). Web first each phase; the app follows.

**Gestures are native-first.** Swipe / one-finger scroll gets built in the
Kotlin app, not the web view — web touch handling wouldn't transfer to Compose
and would mean debugging gesture physics and colour precedence at once. Web
views navigate with prev/next; a web-swipe phase (D) is deferred and optional.
**Known issue to fix if web swipe is ever built:** the current web calendar
needs a two-finger drag to page because a single finger scrolls the grid —
single-finger should page.

## 2026-08 — Device enrollment lives on the household page; QR holds the raw code (v0.179)
**Decision:** the parent-facing enrollment surface is a per-person "Phone app"
panel in the household list (`/setup`), beside the web-login controls — not a
separate admin screen. It generates a one-time code (shown once as a short code
**and** a QR) and lists/revokes that person's devices. The **QR encodes the raw
enrollment code string itself** (not a URL or deep link), so the eventual app
scanner reads the code and posts it to `/api/v1/auth/enroll` exactly as if it
were typed. **Reason:** enrollment is per-person access management, so it belongs
next to the other per-person access controls; keeping the QR payload equal to
the typed code means scan and manual entry hit one code path, and defers any
deep-link scheme until the app actually needs one. The QR is rendered from the
dependency-free `qrcode-generator` on the server (`src/lib/qr.ts`), so it stays
out of the client bundle and the lean dependency set barely grows.

## 2026-08 — Invite links: single-use, validated at page load (v0.178)
**Decision:** an invite link is authority to set a person's *initial* password,
and nothing more. The guarantees, now made explicit and enforced end to end:
- **Unguessable / not replicable:** the token is 256 bits of randomness; only
  its SHA-256 is stored, never the raw value.
- **Single-use:** redeeming sets the password and deletes the invite in one
  transaction, and bumps `credentialVersion` so any prior sessions are voided.
  Issuing or re-issuing an invite deletes any existing one for that person.
- **Expiring:** 7-day TTL, checked on redemption.
- **Validated before the form is shown:** the redeem page (`/join`) now checks
  the token is live *on load* (`inviteIsRedeemable`) and shows an "already used
  or expired" message instead of the password form for a dead token. Previously
  the form rendered for any URL carrying a token, so a used link appeared
  reusable even though the backend correctly refused it — a fix to a
  perceived vulnerability, not a change to the (already sound) redemption path.
**Reason:** possession of the one-time link = authority to choose the first
password is the standard invite model and is fine for the household threat
model; the gap was purely that the UI re-showed the form. Validating at load
closes it without adding a heavier lock.

## 2026-08 — Sending an invite saves and uses the typed email (v0.178)
**Decision:** on the household page, "Send invite" persists the address in the
row and attempts to email the invite in one step; if it can't email (no address
on file, or SMTP not configured/failed) it reports why rather than silently
showing only a link. **Reason:** the email field had a separate Save button and
the action read the *saved* address, so a typed-but-unsaved email was ignored
and the fallback to a link was silent — it looked like sending was broken.

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

## 2026-08 — Mobile identity: per-person device tokens (confirmed, built v0.177)
**Decision (confirmed):** enrollment binds a device to a Person; the device
token *is* the identity; there is no password login on the phone. A parent
generates a one-time enrollment code in the admin area (rendered as a short code
and a QR); redeeming it on the phone mints the token. This is the gating mobile
decision from docs/API.md, now settled as option 1.
**Shape as built:**
- A `Device` row per enrolled phone; only `sha256(secret)` is stored, never the
  raw token — same as an Invite. `Device.expiresAt` (365 d) refuses stale
  tokens; `refresh` rotates the secret; `revoke` soft-revokes the row.
- An `EnrollmentCode` row per pending enrollment: one-time, 15-minute TTL, hash
  only, deleted on redemption (or expiry). One live code per person.
- Surface: `POST /api/v1/auth/enroll` (no auth — the one internet-facing,
  rate-limited, code-gated endpoint), `POST /auth/refresh`, `POST /auth/revoke`,
  `GET /me`, `GET /meta`. All but enroll require `Authorization: Bearer`.
**Reason:** preserves the household model (no per-person passwords), keeps the
web app identity-free, and still lets a phone open to just that person. The
parent-facing "generate a code / see this person's phones" admin screen is the
next increment; the contract and token backend land first.
**Supersedes** the 2026-08 "per-person device tokens (proposed)" entry.

## 2026-08 — Authelia `/api/v1` bypass is unblocked (token surface now exists)
**Decision:** the token-based app authentication surface is built (v0.177), so
the precondition for an Authelia bypass is met. When the bypass is added it is
scoped to **`/api/v1` only**, never all of `/api`. Kairos still authenticates
every `/api/v1` request itself: a bearer token on all endpoints except
`/api/v1/auth/enroll`, which is intentionally public and guarded instead by a
one-time, short-lived, rate-limited enrollment code.
**Boundary that makes this safe:** `/api/v1` is exempt from the app's own
login-gate middleware and does its own per-request auth in the route handlers
(src/lib/api/device-auth.ts). The exemption is scoped by prefix, so no other
`/api` route is opened by it.
**Infra note:** enabling the bypass is a change to the Authelia config on the
server, not in this repo. This entry records that it is now permitted and how it
must be scoped.
**Supersedes** the 2026-08 "Authelia `/api` bypass stays off until app-auth
exists" entry — the condition it waited on is now satisfied.

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
