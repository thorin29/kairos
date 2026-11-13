# Roadmap

Everything this project is meant to do, in one place. Checked items are
built and deployed; unchecked ones are agreed but not written yet.

Nothing here contains household data — plans, chores, names, and schedules
all live in the database, never in this repository.

---

## Current status (13 Nov 2026, web v0.705.0 / app v0.505.0, versionCode 577)

Rewritten on 13 Nov from the `CHANGES` history (web 0.582–0.695) and the app
`CHANGELOG.md` (0.390–0.501). Details and reasons for each item are in
DECISIONS.md (web and app). The workouts plan behind most of this run is kept
in the project docs (workouts-plan, workouts-programs-plan, workouts-next-plan).

**Most recent work (web v0.582–0.695, app v0.390–0.501, migrations 122–152):**

- **Workouts rework, phases 0–9** (web 0.606–0.618, app 0.414–0.426): a
  workouts export; every set logged, with last time's sets as hints; records by
  rep count, how a movement felt and "something hurt"; **programs** that write
  the plan (5/3/1, Boring But Big, 5/3/1 for Beginners and Wave loading from
  0.620, with training maxes, warm-up sets and end-of-cycle raises);
  suggestions that never act on their own; household **equipment** and a
  starting movement library with an ⓘ how-to for each move; **Concept2** sync
  per person; Cardio and Warm-up as plan categories; a **conditioning timer**
  for every format (EMOM, AMRAP, Tabata, for time); a named-workouts library
  with Rx and Scaled; a monthly benchmark; and plan export, import and
  household sharing with a parent's approval. My plans and "your version" of
  a program keep changes across switches (0.620, 0.666).
- **What a day can hold:** warm-up routines with a timer (0.622, 0.655),
  **core days** with a rotation and a monthly plank test scored on the Marine
  Corps PFT (0.637–0.644), arms rotations (0.651), **mobility** (0.659),
  **isometrics** with a monthly test (0.661) and **stretching** (0.663). **Adjust
  today** (Low energy, Short on time, Sick, Hurt; 0.654–0.658, stand-ins for
  a hurt day in 0.675). The week strip pages back and ahead (0.651–0.656). On
  the phone a running timer keeps going outside the app, as a notification
  and a floating window.
- **Workouts page** (web 0.684 / app 0.494): nine action buttons. A single **+
  Additional** (0.667, rebuilt 0.686) covers Conditioning (Pick · Generator,
  where Create new opens the HIIT/CrossFit builder), Family WOD, Strength,
  Cardio, Sport, Mobility, Stretching, Isometrics and something else, each on
  its own page. A plan can have an end date (0.686).
- **Progress views:** lift rows with a trend line, and a page per lift showing
  estimated max, light weeks shaded, marked days and the next set (0.670).
  Also a **Weekly training** chart (0.671), a Core card and page (0.673), and
  **Cardio and Conditioning** charts (0.674). The **Workout days** grid draws
  three or more kinds as pie slices with no gaps, and a tap opens the day's
  breakdown (0.681–0.683). Kind colours are Cardio #0ea5e9, Conditioning
  #c026d3 and Sport #65a30d (0.686). A **chart hover pop-up** works on lift
  charts, Compare, the plank test and the endurance charts, with tap on phones
  (0.692–0.693).
- **Training heat map** (0.664, redesigned 0.689–0.690,
  `src/lib/workouts/training-heat.ts`): the colour is earned by progress and
  eases back, so the map rises and falls instead of filling red.
  - Pale yellow means trained regularly (4 of the last 6 weeks).
  - Yellow, orange, dark orange and red come from each main movement's best
    over the last 3 weeks compared with 12 and 26 weeks back.
  - It moves up at most a step every 2 trained weeks and eases a step every 3
    weeks when progress stalls.
  - Assisting work counts ¼ of a set and holds never count for progress.
  - A program start resets the 12-week comparison; sore holds and pauses
    freeze it.
  - The endurance heart follows the same rules on weighted minutes. The pop-up
    shows "+N% since you started".
  - Carries map to a region (0.690): farmer → arms (grip), suitcase or one-arm
    → core, overhead → shoulders.
  - No map toggle and no stars, by decision.
- **Smarter suggestions** (0.675–0.677): sore spots on the body map,
  hockey-aware days (a game, a tournament), push/pull balance, a "plan too
  big" nudge, and swapping a leg day away from a game for that week. A sport
  event type can be Game, Practice or Other.
- **Family WOD** (0.679–0.685, migration 151): a parent picks a family workout
  for a day and people opt in. The person on the device is listed first, and
  nobody is selected by default. Each WOD gets a board, anyone can suggest one
  for a parent to approve, and it never counts as missed.
- **Pauses** (0.678–0.688, migrations 150 and 152): a person's own workout
  pause (Sick, Injured, Vacation or Other) picked on a range calendar, up to
  180 days and plannable ahead. A household pause covers everyone's workouts.
  An admin can pause one person's chores and workouts from Admin → Calendar
  (`Pause.userId`). Paused days get no prompts, never count as missed and
  don't cool the heat map.
- **Companion lifts** (0.665, 0.694): lifts that aren't a program's main lift
  step up only after **Easy**, and only for sets that hit their reps. The step
  size comes from the movement, not the plan slot. Dumbbells and kettlebells
  step to the next size in the household equipment list. Program main lifts
  and 5/3/1 waves are unchanged, and training maxes on a running program are
  read-only (0.685).
- **One UI rule on both platforms** (web 0.680–0.684, app 0.490–0.492):
  anything you search, fill in or step through is a full page (app
  `ui/common/FullPage.kt`; web `Modal`, with `Modal small` for a centred
  pop-up). Small pop-ups are only for short choices, confirmations, ⓘ, date
  pickers and breakdowns. No pull-up sheets. Web Edit plan and the HIIT
  builder use the shared `SECTION_CARD` / `SECTION_LABEL` / `CHIP` (0.691).
  Both clients roll over at midnight (0.687 / app 0.497).
- **Elsewhere:**
  - **Hockey page** from the ice-time container (0.600–0.602; public skate
    0.641).
  - **Scoring rework** with "How scoring works" (0.603).
  - **Change your own password** (0.605 / app 0.413).
  - **Companion profile icons** (0.582 / app 0.392).
  - One family-goal vote per person per month (0.583), and shared-chore turn
    reminders (0.584).
  - The **Android home-screen widget** (0.588 / app 0.398 on).
  - Calendar fixes for all-day and repeating events (0.590, 0.597), the
    Anniversary type (0.591) and the Marine Corps Birthday holiday (0.592).
  - Groceries renamed **Shopping**, plus about 65 more icons (0.594–0.598).
  - Repeating tasks: Yearly and every N days (0.668–0.669).
  - App **Settings reorganized** (app 0.501): profile card, Account (Password,
    Devices, Sign out), Look & feel, Notifications & reminders, Connected apps,
    Parents, Help & about.
- **ROG Ally icon on Game time (0.705; 0.704 superseded before deploy):** the
  collector's third source (`"ally"`, collector 5.0.0) gets the ROG logo beside
  Xbox and Steam; unknown
  sources draw nothing. App follow-up pending (the Game time screen needs the
  same icon).
- **Paused classes (0.702, migration 154):** pause a class per student; it
  keeps one open item that never goes late, the next appears when it's done,
  and Resume lays the rest out again. The app shows it as "paused" with
  done/total (app 0.505, server 0.703). Catch up also lists late-but-on-
  schedule classes, locked (0.703).
- **School catch up (0.701):** re-baseline a behind student (or everyone) from
  Curriculum & schedule. Undone plan work restarts from the next school day,
  oldest first; a class that would then finish past its deadline is left for
  the student to manage, and fit-to-term classes re-fit.
- **Next.js 16 (0.700):** its own release. Clears the last production audit
  warning (Next 15's bundled PostCSS, build-time only). `middleware.ts` is now
  `proxy.ts`; builds use Turbopack; `next lint` is gone (there was no ESLint
  set up, so the script was dropped).
- **Threat review and fixes (0.699 / app 0.504):** sign-in required on every
  web page, parents only (the shared screen signs in once); PIN 3 tries per 15
  min per device and bound to the PIN; frame and nosniff headers; sign-in
  redirect, calendar-feed address filter, one 8-character password minimum,
  and helpers moved out of server-action files.
- **Security updates (0.698):** Next.js 15.5.29 (two critical image-optimizer
  advisories), the unused `/_next/image` endpoint off, Prisma 7.10.1,
  Nodemailer 10. A code-level threat review follows.
- **Character switching (0.697, migration 153):** growth stays with the
  character that earned it (a day splits at the switch), parts of a square
  are no longer rounded away (`growthBanked` was an integer), and deepening
  resumes after a trip to the gallery.
- **Loose ends (web 0.696 / app 0.502–0.503):**
  - admin auto-lock after idle time (Admin → Settings → Device);
  - full-body moves on the body map and the heart;
  - the web all-day form's red end and disabled Save;
  - Remaining sets removed on both clients;
  - the heat map's unused ranges and dead app code removed;
  - every app pop-up on `AnimatedDialog`;
  - the ROADMAP checked against the code.
- **0.695:** `MIGRATIONS` in `version.ts` had stopped at 127, so `/about` wasn't
  checking migrations 128–152. They're registered now.

**Earlier runs:** see "Shipped — Sept 30 – Oct 14 2026 run" and the sections
before it, below. The large efforts from before that (app offline support, the
Settings epic, local notifications, the curriculum planner, sport attendance,
companions art) are recorded there and in DECISIONS.md.

**Still open** (the 25 Sep audit list, re-checked 13 Nov against the code):

- export of the household to JSON (workouts have their own export);
- a dashboard weather panel;
- a month/week completion grid;
- drag-and-drop reordering;
- Kairos-side TOTP;
- an admin audit trail;
- Bible balance by verse count.

Also agreed and not built:

- the Seasons quality signal (workout progress into Strength; reading beyond
  the plan into Wisdom), kept as is for now;
- play on a shared or unmanaged PC isn't tracked (see Game time below);
- ice-time following a schedule index page.

Next up, roughly in order:
- The features listed per section below, to explore later.

---

## Personal settings (per-user, non-admin)

Decided 13 Nov: the web is a shared device, so it has no personal settings
to build. The code keeps Personal mode as an admin option (Admin →
Settings → Device), with its profile page (picture, colour, password,
Concept2, workout timer), but it isn't advertised; personal settings
belong in the phone app. Admin keeps its PIN on the web for the same reason.

- [x] Change your own password (web 0.605 profile page / app 0.413 Settings).
- [x] Appearance / themes — light and **dark mode**, plus **eight color themes**
      (teal, olive, green, blue, purple, pink, orange, red). Shipped in the app
      (per-device) and on the web from **Admin → Appearance** (household-wide);
      the palette moved behind CSS variables / a snapshot color state so a theme
      swaps them all. (The web put this in the admin area rather than a personal
      sidebar settings page.)
- [x] Personal calendar event colours, view, and filters — now specced as the
      **Personal calendar** epic under "Personal-view scoping" below (model and
      precedence in DECISIONS.md). Your personal view is recoloured and
      filtered per-person; the shared wall-tablet view keeps the household-wide
      settings.

---

## Foundations

- [x] Single application container plus PostgreSQL, deployed from GHCR
- [x] Unified task model — chores, reading, school, and one-off tasks share
      one completable row, so percentages and streaks are one query
- [x] Overdue as a read-time rule rather than a rewritten due date
- [x] Calendar-day dates kept separate from real instants; process runs UTC
      with a separate household timezone
- [x] Schema migrations applied automatically on container start
- [x] Nightly `pg_dump` into the mapped data volume
- [x] About page with version number and a migration completeness check
- [ ] Export everything to JSON from the admin panel

#### Android app — decided direction

PWA is ruled out: several users have browsers blocked by the device time-limit
container, and a PWA needs a working browser. The app will be a **native
Kotlin / Jetpack Compose** client in a separate repo (`kairos-app`), talking to
a versioned REST API (see docs/API.md). This reverses the earlier Capacitor
plan — see DECISIONS.md ("Native Kotlin for Android, not Capacitor") for why:
with a near-stable web UI and a bounded mobile surface, building the native UI
once beats a Capacitor UI now and a native rebuild later. The React web app is
unchanged; Android is a new client on the shared API.

The two gating pre-Kotlin decisions are now settled: the **mobile identity
model** (per-person device tokens) and the **`/api/v1` contract** (docs/API.md).

- [x] Confirm the identity decision — **per-person device tokens** (v0.177,
      DECISIONS.md).
- [x] Auth/identity + meta slice of `/api/v1` (v0.177): `auth/enroll`,
      `auth/refresh`, `auth/revoke`, `me`, `meta`. Device + EnrollmentCode
      models, hash-only token storage, rotate/revoke/expiry, per-source rate
      limiting on enroll, edge-exempt + self-authenticating routes.
- [x] Admin enrollment UI (v0.179): a per-person "Phone app" panel on the
      household page — generate a one-time code (short code + QR), and list /
      revoke that person's enrolled devices. Independent of web login.
- [x] Rest of the `/api/v1` surface. Built: auth `POST /auth/login` + `/auth/reauth` (v0.187–0.188 — the layered
      login+code enrollment and the credential-version re-login gate), device
      visibility (v0.189 — `GET /devices` · `POST /devices/{id}/revoke` +
      new-device email alert), `GET /dashboard`
      (v0.185), task completion, and workouts — day-level (v0.186) plus detailed
      weight × reps logging (v0.190, `GET /workouts` · `POST /workouts/log`), and
      **reading** (v0.204 — `GET /reading` aggregate + `POST /reading/plan`,
      `/plan/delete`, `/mark`, `/books`, `/books/bulk`; shared core
      `lib/bible/personal-core.ts`; `color` added to `/me`), and **chores**
      (v0.206 — `GET /chores` read-only overview, role/kind-scoped: parent-or-admin
      sees the household, others see only themselves), the **dashboard personal
      reading** (v0.207 — `personalReading` on `/dashboard`, toggled via
      `/reading/mark`), and the **shared-chore dashboard actions** (v0.208 —
      `upForGrabs` + `alwaysOpen` on `/dashboard`, chores only, seen by everyone;
      `POST /chores/claim` + `POST /chores/always-open` acting for the enrolled
      person; guard-free cores in `lib/chores/dashboard-actions-core.ts`), and the
      **calendar** (v0.210, Phase 1 — `GET /calendar` read-only Month/Agenda/Day,
      colours resolved from saved prefs; `queries/calendar-page.ts`).
      Remaining: non-weight/multi-set/HIIT workout logging, rewards, calendar
      phases 2-5 (time-grids, add/edit, options drawer, colour personalisation),
      companions, push, sync. Additive-only; logic reused from existing server
      code. (done: 193 routes, and the app has caught up with the web)
- [x] Add the Authelia bypass — now unblocked; scope it to **`/api/v1` only**
      (DECISIONS.md). Infra change on the server, not in this repo. (done, in use for a long time)
- [x] Native Kotlin client scaffold + enrollment/sign-in (`kairos-app` v0.1.0):
      Compose + Retrofit + kotlinx.serialization, device token encrypted in the
      Android Keystore, configurable base URL (no host baked in), and a
      SessionState-gated flow Setup → Enroll (code entry) → Home; sign-out
      revokes. QR scan and the real dashboard are the next increment.
#### Android app — build-out plan (parity with the personal/mobile web view)

**Approach (agreed):** build the navigation shell first, then complete one
section at a time to **full parity with its web personal page** — API endpoints
(reads *and* writes) + native page + all sub-features — before starting the next
section. No shipping a dashboard action-rail and jumping domains. The app is
inherently single-person (the enrolled device is one person), so personal-view
scoping is automatic.

The eleven sections (from `src/components/sidebar.tsx`): Home, Calendar, Chores,
Bible reading, Reading, School, Game time, Workouts, Groceries, Money,
Characters. Each drawer entry keeps its web brand colour.

- [x] **App Settings menu** (`kairos-app`): reached by a gear next to the
      person's name in the drawer. Holds Appearance (dark mode + color themes +
      24-hour clock), Profile (photo/framing + your synced color), and
      Notifications.
- [x] **Phase 0 — navigation shell** (`kairos-app`): the drawer the top-left
      logo opens, all eleven sections with active state, Devices + Sign out in
      the drawer footer. Home is the real page; other sections show a placeholder
      until built. (Done, custom overlay rail with Kairos branding.)
- [x] **Workouts — full parity** (web v0.200, app v0.24). Shipped: Log workout
      page (Today's plan + "log a different workout"), Recent workouts (own page,
      edit-gated confirm delete), progress graph (single tracked movement,
      defaulting to today's/next weights, stepped scale, tappable points, name
      selector), This week, Browse workouts (Workouts / Hero WODs), Weight
      calculator (bars from the uploaded SVGs), and Edit plan — weekly (add via
      category→muscle→exercise / named workout / rest, remove, mark-rest,
      copy-from-day) and Rotation (start/stop, rest-weekday mask, 10-day preview,
      slots add/remove/reorder). Deferred (small): rotation slot **edit** +
      **anchor date** (Edit plan step C2); on-device confirm of the weight-
      calculator bar corners.
- [x] **Bible reading — full parity** (web v0.204, app v0.25). Family/Personal
      tabs (ProgressTabs): the family reading deck (swipe + arrows + back-to-today,
      −7…+14 window) with days-left/plan-runout, OT/NT + by-group coverage; and
      the personal tab — own coverage, "Your plan" (create via books + start +
      chapters/day with live estimate, or work an existing plan, tick days,
      confirm-gated delete keeping read chapters), and "Manual checklist"
      (genre book grid + per-chapter modal, Mark OT/NT read, clear hand-marked).
      Server: one aggregate `GET /reading` + writes `plan`, `plan/delete`, `mark`,
      `books`, `books/bulk` over shared core `lib/bible/personal-core.ts`; `color`
      added to `/me`. Like the web page, family completion stays a dashboard
      task — no family-tick on this screen. (Replaces the dashboard tickbox for
      the personal daily surface.)
- [x] **Chores — full parity** (web v0.206, app v0.26). Read-only household
      overview mirroring the web `/chores` page: pause banner, "This week"
      (per-person due/done/open/missed), "Weekly rotation" (per-person, day-by-day
      with past-due red + done check), "Always open" (household tap-counts), and
      "Shared chores" (pool status + tally). Role/kind scoped: a **parent OR
      admin** sees the household (self + every child) in a table + card grid; a
      non-admin child sees just their own compact summary + rotation; always-open
      and shared chores are household-wide for all. Server: one aggregate
      `GET /chores`. Completion stays on Home (dashboard tasks); management stays
      the PIN-gated `/admin/chores`, web-only. Pool *claim* deferred to a future
      dashboard action.
- [x] **Calendar — phased.** Phases 1, 2, 4 done + Phase 3a (web v0.210-0.214,
      app v0.27-0.32): read-only **Month / Agenda** + **Week / 3-day / Day
      time-grids** (viewer-tz localisation, overlap lanes, all-day row, swipe
      paging), the reworked **month grid** (uniform cells, chips), the right-side
      **settings drawer** (icon+highlight view picker, default-view, people/family/
      school-work/subscription checkboxes), and **create a basic event**
      (`POST /calendar/event` — single occurrence, per-event timezone default home).
      `GET /calendar` returns in-range events, month grid/dots, now-line colour,
      household timezone, and the filter options. Remaining: 3b) recurring **edit / delete-this-occurrence** (recurring *create*
      done v0.218: daily/weekly/monthly/yearly) / participants / event-types; 5) colour personalisation.
      **End-of-epic polish (remind before closing the epic):** (a) smooth
      drag-follow swipe paging (the current swipe is fling-to-page, not a pager
      that tracks the finger with pre-rendered neighbours); (b) the month-name
      dropdown could look better; (c) the app editor's pop-up menus (Type,
      Calendar, Timezone, Repeats) render as a left-anchored popup rather than a
      true dropdown attached to the field — switch to a proper anchored dropdown. Also by end of epic: the dashboard should be
      able to **ask whether sporting calendar events were completed** (it's
      calendar-event-driven — see Dashboard). (done: recurring edit / delete one occurrence and per-person colours shipped since)
- [x] **Remaining sections to parity:** School and Characters (CharacterScreen)
      shipped; **Game time** was rebuilt from the retired allowance model into an
      automatic monitoring feature (collector container → Kairos → web + app),
      un-parked and back in the nav.
      - [x] **Reading** (web v0.250 / app v0.74): strictly self-only leisure
        book-tracker (`GET /api/v1/books`, no one sees anyone else's). A book has
        a title, optional **author**, and a size in **pages and/or chapters**
        (at least one; both allowed — progress tracks pages when both are set).
        Enter the **page/chapter you're up to**; how far you've read derives
        from that at read time and feeds the **Scholar** stat (via
        `progression.ts`), so paging back and forth never double-counts. **Shelve**
        drives a **Bookshelf** of To read / Read; "Move to reading" / "Reopen"
        returns a book to the queue (resuming where you left off). Mark finished
        completes to 100%. Delete asks first. Web `/reading` became a per-person
        card that opens that person's queue + shelf. Endpoints: `/api/v1/books` +
        `add`/`log`/`update`/`finish`/`shelf`/`delete`, all self-only.
      - [x] **Money** (web v0.248-0.249 / app v0.72-0.73): per-person ledger with
        running balances (`GET /money`, personal-scoped — child sees self, parent
        sees self + kids), add a deposit/payment (`POST /money/entry`, lands
        PENDING), search, and a single participant collapses the people selector.
        **Parent admins get full admin parity minus CSV import**: approve /
        unapprove / approve-all, edit, delete, and set starting funds
        (`/money/approve|unapprove|approve-all|update|delete|starting`, all
        admin-device-only), plus the Bible-reward payout approvals
        (`/money/rewards/approve-month|approve-base`). The home dashboard shows an
        amber reminder banner (`/dashboard` carries admin `money` counts) →
        Review opens Money. The add/edit forms use pop-up selectors (Type,
        Category, For, frequent-payment) rather than inline dropdowns. Approval on
        the shared web tablet still requires the PIN (the app gates on the device
        role instead). Device routes delegate to shared cores in `lib/money-core.ts`
        + `lib/bible-rewards.ts`.
        Deferred (still web-admin only): **CSV import** (one-time) and the Bible
        **reward-settings config** form (per-person opt-in/amounts, bonus, grace).


      - [x] **Persistent "Phone app" badge count** (v0.201) — done via one
        grouped `liveDeviceCounts()` threaded as `initialCount`.
      - (original note) **Persistent "Phone app" badge count.** Today `DeviceEnrollment` loads a
        person's devices lazily on expand (intentional — avoids N queries on the
        household page), so the count only appears after clicking. Fix without
        making it eager: compute live-device counts for everyone in ONE grouped
        query at the setup-page level (Device where `revokedAt` null and
        `expiresAt` in future), thread the count into `AccountRow` →
        `DeviceEnrollment` as an `initialCount` prop, and have the badge render
        `loaded ? liveCount : initialCount`. The existing lazy full-list load
        stays for the expanded view.
      - [x] **Hard-delete for revoked rows** (v0.201) + confirm-gated revoke/
        delete (v0.202). Done.
      - (original note) **Hard-delete for revoked rows.** Add `deleteDevice(deviceId)` in
        `src/lib/api/device-auth.ts` (`prisma.device.delete`), a
        `deleteDeviceAction` (`requireAdmin`) in `src/lib/actions/enrollment.ts`,
        and a trash-icon button on **revoked** rows in `device-enrollment.tsx`
        (it already imports `TrashIcon` and has the revoke wiring to mirror). Soft
        revoke stays the default; delete only clears already-revoked rows so the
        list stops growing.
- [x] Avatar API (web v0.201–0.203): device-authed `/api/v1/avatars/[file]`,
      `/me` sends `avatarUrl` + `avatarPosition`, app renders photos via Coil
      (token-authed) with the web's position/zoom transform.
- [x] Rest of the native client (`kairos-app`): Room (offline cache) and
      WorkManager (reminders, complete-from-notification) shipped; enrollment
      is a `kairos://join` link, so the phone camera scans the QR code (no
      in-app scanner); FCM replaced by local notifications (below).
- [x] **Notifications epic** — shipped, but **local (AlarmManager + WorkManager),
      not FCM**: reminders are set **per event** (Proton/Google style — multiple,
      with lead times at start / minutes / hours / days / a week / custom), stored
      on the event server-side (`Event.reminders`, migration 77). A per-device
      master switch (default OFF) + a test notification + a link to Android's
      per-channel sound/vibration settings. The firing engine fetches upcoming
      events (`GET /api/v1/notifications/upcoming`), schedules exact alarms, posts
      the event name, and re-arms on reboot. Reminders are **app-only** (no web
      event-editor reminders for now); the per-type default field exists in the
      schema, kept OFF, with no UI. Originally specced below as FCM/push:
- Push stays **local** by decision (13 Nov): no FCM. If server-triggered,
  instant notifications are ever wanted (a parent sets a Family WOD, an
  approval lands), the option is self-hosted **UnifiedPush** (an ntfy
  container on the server) rather than FCM: no Google account or keys, and
  household notifications stay in the house. Not planned; noted as the path.
- [x] **Offline** for the personal daily surface and the calendar (two-way),
      replaying writes through the same POST endpoints — see the phone app.

## Dashboard

- [x] A card per person with per-category completion and colour states
- [x] Neutral rather than red when nothing is assigned
- [x] Overdue work surfaced and carried forward
- [x] Today's schedule strip with unlimited day navigation
- [x] "Up for grabs" section for released and shared chores
- [x] Weekly-start-Sunday convention throughout
- [ ] Weather panel: current conditions, high and low, icon reflecting time
      of day and sky, moon phase
- [ ] Weekly forecast page styled after Breezy Weather
- [ ] Month and week completion grid — every person's rate by day
- [x] **Follow-up prompts on the home dashboard** (nudge, don't nag):
      - **"Did this happen?" for sporting calendar events** — after a sport event
        passes, ask whether it was completed (feeds scoring/streaks). Calendar-
        event-driven, so integrate by the end of the calendar epic.
      - **"Did you go?" for classes** — confirm class attendance/completion.
      - **Bible reading rewards ready** — remind when a reward is available to
        claim. (all three done: sport attendance prompts, class "did you attend", the Bible-reward nudge on the home page; verified 13 Nov)

## People and profiles

- [x] First-run household setup
- [x] Photo upload or preset icon, per-person colour, display name
- [x] Birthdays, with age, recurring annually on the calendar
- [x] Parent and child roles
- [ ] Per-person dashboard ordering

## Access control

- [x] No sign-in for viewing or completing — the dashboard is a shared screen
- [x] Numeric PIN pad unlocking the admin area for a few hours
- [x] Route-level guard so a typed URL cannot reach an admin page
- [x] Parents can change their own PIN
- [x] Read-only metrics pages separate from the editors behind the lock
- [x] Shared pages reached from the admin hub offer a way back to it while
      the unlock is live
- [x] **First-party personal accounts (foundation).** A person's profile can
      carry an optional password credential; with none they stay a
      wall-tablet-only profile, so the shared screen is unchanged. Login is by
      the existing unique name — no email, since re-inviting is the reset path.
- [x] **Invite-only, admin-issued.** No self-signup route exists. A parent
      issues a one-time, hashed, expiring invite from Household → Accounts and
      hands over the link; the person redeems it to set their own password.
      Disable clears the credential and voids sessions.
- [x] **Stateless personal sessions**, signed with the shared app secret,
      separate from the admin unlock. `credentialVersion` in the cookie means a
      reset or a disable invalidates every existing session.
- [x] **Emailed invites (optional).** A person can be given an email in
      Household → Accounts; sending an invite then also emails the link, with
      the copy link kept as a backup. SMTP is configured in Admin → Email (env
      var **or** GUI, env wins), with a test button that surfaces the real SMTP
      error — tuned for Proton Bridge (STARTTLS, self-signed cert, TLS 1.2).
- [x] **Sign in by name or email.** Email is optional; a child without one
      still signs in by name.
- Auth direction settled (see the two-turn scoping): first-party accounts are
  the base, built regardless; delegating to the household's own Authelia via
  OIDC is a possible *additional* login method later (the Immich pattern —
  one user table, OIDC layered on, auto-register off to keep invite-only). Not
  social OAuth: it fights the no-email-for-kids and blocked-browser cases.
- [x] **Device modes** — a device is shared/kiosk (the wall tablet, no login)
      or personal (a phone, signed in). Nothing is gated behind login yet; this
      is the next phase. (done: `deviceMode()` in `src/lib/device.ts`, verified 13 Nov)
- [x] **Device modes shipped.** Admin → Device toggles this screen between
      Shared (whole household) and Personal (the signed-in person), stored per
      device in a signed cookie. Default is shared, so existing installs are
      unchanged.
- [x] **Login-gating shipped (page level).** A "Require sign-in" switch (off by
      default; can't be enabled until someone has a login) makes every page
      redirect to /login without a session. The gate lives in the root layout
      (needs the DB); middleware only forwards the path.
- [x] **Profile edits are admin-or-self once sign-in is required** (open on the
      shared tablet otherwise).
- [x] **Mutating actions guarded.** The shared-screen writes (tasks, groceries,
      events, workouts, reading, calendars, plays) now call `requireInteractive()`
      — a no-op while sign-in is off, a session requirement once it's on. The
      shared tablet still works because it's itself signed in as an admin.
      Admin-only actions keep their stricter PIN guard. With this, page access
      *and* writes are gated, so Kairos is much closer to standing on its own —
      though keeping Authelia in front remains the sound default (defence in
      depth, and it carries 2FA).
- [x] **Per-resource ownership** (finer than session-level): e.g. on a personal
      device, only log your own workout. Not needed for the shared tablet, where
      acting for the whole household is the point. Revisit with the phone app. (done: `requireCanActFor` in `src/lib/gate.ts`, verified 13 Nov)

#### Personal-view scoping (for the phone app screens)

On a personal device each page should show only the signed-in person. The data
scoping is worth doing regardless of the app; the layout tweaks are really the
phone screens. Track A (the non-personal fixes) shipped in 0.159.0; these are
the remaining personal-view items:

- [x] #6 Reading — only your own reading.
- [x] #7 School — only your classes, assignments, tests.
- [x] #8 Game time — only you.
- [x] #9 Workouts — only you, and open straight onto the workout overlay/page
      rather than a card you then tap.
- [x] #11 Transactions — only your transactions; hide the page/menu entry
      entirely if you have no data.
- [x] #12 Character — only you, and move the character onto this page from the
      home card.
- [x] **Personal calendar (web first, then Kotlin app).** The signed-in
      calendar becomes per-person: its own view, filters, and colours, stored
      server-side so a phone and the web personal view always match. The shared
      wall-tablet calendar is untouched — it keeps the household-wide settings.
      Full model and colour precedence are in DECISIONS.md
      ("Personal calendar: per-user preferences…"). Built on the web first so
      the logic is proven before the app renders it. Phases:
  - [x] **A — structure.** *(shipped 0.180.0)* `UserCalendarPref` model (+
        migration 72); a right-side options drawer (sliders icon top-right);
        all five views (added **3-day** and **agenda**); persistent people,
        family, school-work, and subscription checkboxes; per-user, stored
        server-side. Branches off `deviceMode` — the personal view only shows
        on a signed-in personal device; the shared wall tablet is unchanged.
        Defaults: just you, family **off**, school work **on**. No colour
        personalisation yet (that's Phase B).
  - [x] **B — colours.** *(shipped 0.181.0–0.182.0)* A "Personalise colours"
        master toggle in the options drawer, the `OWN / GREY / FAMILY`
        others-mode, now-line override, and per-user overrides for each event
        kind (Appointment/Class/Work/Birthday), holidays, **each custom
        EventType**, and **each subscribed feed**. School work follows the
        **Class** colour; OTHER stays system; holidays and birthdays recolour
        uniformly. Each colour has an Auto reset to the shared default.
  - [x] **C — month-name dropdown + polish.** *(shipped 0.183.0)* On the
        non-month views, tapping the month name drops a mini-month (single-letter
        weekdays, up to three coloured event dots per day, caret that flips) for
        jumping to any date; neighbouring-month days are tappable too. The month
        view already fills the screen and carries the add (+). Menus stay clean
        with no explanatory text.
- [ ] Kairos-side TOTP for the eventual app API path that bypasses Authelia.
- [ ] **"Act as me" step-up** on the shared tablet — attribute a single action
      to a person (tap avatar, optional personal PIN) without turning the
      tablet into a private session. The grocery "I'm going shopping → cart"
      flow now exists as a shared run; this would let a run be tied to one
      person (their name on the trip, their staples) if that ever proves useful.
- [x] **Personal / focused views** on a signed-in device, plus a summary page
      that's one tap away rather than front-and-centre. (done: the personal-view scoping below, verified 13 Nov)
- [ ] Audit trail of admin changes

## Chores

- [x] Master chore list, separate from who does it and when
- [x] Assignment by chore, person, and weekday, from dropdowns
- [x] Weekly repetition, generated two weeks ahead
- [x] Reconciliation — edits take effect immediately without orphaning rows
- [x] Expiry by succession: an unfinished chore expires when the same chore
      next comes due for anyone, never on a timer
- [x] Catch-up window shown per assignment slot
- [x] Warning for chores nobody is assigned
- [x] Release a chore for one day; anyone can claim it
- [x] Shared chores: unassigned, claimed by whoever gets to them, recurring a
      fixed number of days after each completion
- [x] Pause and resume shared chores for the season
- [x] Cumulative missed count per person
- [x] "Do anytime" chores: assigned but not tied to a weekday, done any day
      within a one-or-more-week period, late only at period end, then reset
- [x] Collaborative, shared, and anytime chores pick from the master list
      rather than free text
- [x] Rename a chore in place from the master list
- [x] Move an assignment to another person or day from its card
- [x] Reorder the household by dragging the chore cards
- [x] Collaborative chores — one chore shared by several people, each doing
      their part, with a weekly / every-other-week / every-N-weeks frequency
- [ ] Smooth animated card reordering with a dedicated drag library (dnd-kit)
- [x] Rotation helper — assign one chore across several people in sequence
- [x] Gate a collaborative chore as complete only once everyone has done it,
      surfaced in a household view

## Bible reading

- [x] Plans stored as data, never in the repository
- [x] Import a dated schedule; draft first, publish when checked
- [x] One reading task per person per day
- [x] Coverage statistics: Old Testament, New Testament, and by group
      (Pentateuch, History, Wisdom, Major and Minor Prophets, Gospels, Acts,
      Paul, General Epistles, Revelation)
- [x] Today's reading shown large, with neighbouring days as cards either
      side that can be brought to the centre — by click, arrow, keyboard, or
      swipe
- [x] **Plan generator** — pick books, a start date, which weekdays carry a
      reading, and either chapters a day or a finish date; previewed live and
      saved as a draft
- [x] Carry on from where the published plan leaves off, so a book already
      read isn't scheduled twice
- [x] Keep books whole — a day's reading never runs across two books
- [x] Reorder the reading — books read top to bottom of a list you arrange,
      not fixed to canonical order
- [x] Extra one-off readings pinned to a date (Christmas, Easter) that don't
      count towards coverage
- [ ] Balance by verse count rather than chapter count so days stay even
- [x] Per-weekday chapter counts, including a lighter Sunday as an option
- [ ] Guarantee no passage is scheduled twice within a plan
- [x] Preset plans generated from book lists (canonical, historical,
      chronological, New Testament only) — generated here, not copied from
      published plans
- [x] Importer: file upload, preview-before-commit, documented grammar
- [x] "Up for grabs" is claimable on the Chores page (tap who did it), above
      the weekly rotation (v0.119.0)
- [x] Tap a person's card on Characters for a popup of what they completed that
      day, with day-to-day scrolling (v0.119.0)
- [x] "Always open" shared chore (e.g. take out the garbage): perpetually up
      for grabs, regenerates the instant it's done; Chores page shows a per-user
      tally of who's done the shared chores (v0.120.0)
- [x] Throughout-the-day countable chore (v0.122.0): always available, tap a
      face each time it's done (any number of times a day); dashboard logs it,
      summary shows who did it today with counts
- [x] Calendar events: start & end time with a clean time picker; in week view
      place the longer event on the left of each day. Start and end are each
      picked from a half-hour drop-down (off-grid times still typable), an event
      can end on a later day (past midnight in one entry), and overlapping week
      blocks draw the longer one leftmost \u2014 day view unchanged (v0.123.0)
- [x] Cycle-based workouts: choose specific rest days, N-day rotations off the
      weekly grid.
      - [x] Phase 1a — rotation model + fixed rest days that pause the cycle +
            builder with 10-day preview, on each person's own workout card
            (choose Weekly or Rotation when creating a plan); scheduling derived
            at read time (v0.126.0, moved to the user card in v0.127.0)
      - [x] Phase 1b — log a workout (or rest day) for a past day via a date
            picker on the Log screen, completing that day's prompt (v0.128.0)
      - [x] Phase 2 — superseded: an overdue workout ages out after the overdue
            window (Admin setting), and "Skip overdue" clears them by hand
- [x] Leisure book reading: add a book (name + length in pages or chapters),
      log daily, never overdue, not a checklist item. A Reading section with
      per-person books + progress; feeds Scholar XP slightly (normalized across
      pages/chapters, capped at length) (v0.132.0)
      - [ ] Follow-up: a gentle "currently reading — read today?" nudge on the
            dashboard person card (kept off the card for now)
- [~] Personal Bible reading (own program alongside the family plan); no
      reward, feeds Wisdom XP the same slight way leisure reading feeds Scholar.
      - [x] Phase A — per-person chapter-read record + personal coverage stats +
            free-form "mark anything read" tracker + Wisdom XP (v0.133.0).
            Surfacing: personal device shows a Family/Personal toggle on the
            Bible page; shared device stays family-only and each person's reading
            is logged from their own dashboard card (person page), for any user
            on a shared device (v0.133.0–v0.135.0)
      - [x] Phase B — personal scheduled plans (generate-only): create your own
            dated plan (pick books + start + chapters/day), daily cards with a
            tick that marks those chapters read, feeding the Phase-A coverage and
            Wisdom. Personal plans carry an owner and never touch family reading
            (v0.137.0)
      - [~] Later: import a personal plan (paste) is still open; the family +
            personal readings now show as two check-offs together on the day
            (v0.138.0)
- [x] Shared events across profiles: a "Share with" picker on every event's
      add/edit form; shared events show on each member's calendar in everyone's
      colours as split bands or a wheel-mixed blend (avoids brown), toggled under
      Admin → Calendar. Editing syncs participants (v0.129.0)
- [x] Past sport event logs as a workout — done as a "did you do it?" prompt
      for calendar sport events (Yes logs it; v0.656 edits it afterwards)
- [x] Recurrent classes: ask if they end at semester end and tie to that
      semester; if none exists, prompt to create one. The class form prompts for
      a term on recurring classes (bounding the meeting to the term's dates) and
      lets you add a semester inline when there are none (v0.130.0). Optional
      "Runs from / Runs until" dates let a class run only part of a term (a
      half-semester class) or any custom span (v0.131.0)
- [x] Editing a recurrent event prompts "this occurrence" vs "the whole series"
      up front on Edit (mirrors the delete chooser); the choice pre-selects the
      in-form scope and can still be changed before saving (v0.124.0)
      (mirroring the delete prompt), instead of silently editing one occurrence
- [ ] Memory verses: assign verses to memorise, track progress, and count them
      toward the Wisdom stat (reciting/marking one done nudges you above the
      reading baseline)
- [ ] Export a plan for editing and re-import
- [x] Coverage counts the whole run of the published plan, not just the
      current calendar year, and books can be marked already-read so the
      percentage reflects where the household actually is
- [ ] **Reading eras** — statistics accumulate across successive plans and
      reset only when an admin says so
- [ ] Admin bulk-complete: mark everything read through a chosen date, for
      everyone
- [ ] Admin override for a single day across the whole household
- [x] Mark reading read by chapter, not only whole books — a book part way
      through (Psalms) can be ticked as far as it's been read
- [x] Plan progress marks its chapters automatically as the days pass,
      independently of whether anyone ticked their own daily box
- [x] Badge for a complete Bible (household level)
- [ ] A count of full passes through the whole Bible

## Calendar

- [x] Day, week, and month views
- [x] Outlook-style week grid with hour gutter and side-by-side overlaps
- [x] Colour by person when everyone is shown, by category when filtered
- [x] Subscribed ICS feeds, one subscription per person with its own name
- [x] Manual events: appointments, classes, work shifts, birthdays
- [x] Recurrence — daily, weekly, monthly, annual, custom interval, end date.
      A weekly event can also repeat on several chosen weekdays at once
      (Monday + Wednesday), defaulting to the start day's weekday (v0.74.0)
- [x] Selected day shows tasks on the left and schedule on the right
- [x] Deletion rules: parents only for repeating events and birthdays
- [x] Edit an existing event — from the event menu (long-press / right-click).
      For a repeating event you choose "this event only" (a detached override on
      that date) or "all events in the series"; single overrides render in place
      of the skipped occurrence and can themselves be re-edited or deleted
      (v0.63.0). A series edit can now also change the repeat pattern and end
      rule, or stop it repeating (v0.65.0)
- [x] A repeating event can end after a number of occurrences, not only on a
      date — the add form's "Ends" option offers Never / On a date / After N
      times (v0.64.0)
- [x] Split events crossing midnight across both days — a timed event is cut at
      each midnight it crosses and drawn as a segment on every day it touches, so
      a late finish shows on the next day instead of being clipped (v0.72.0)
- [x] Calendar add-event UX: pop-up overlay instead of a bottom form, opened
      from a + at the top; tap a day/time slot to prefill (v0.49.0)
- [x] Custom event types are editable (rename + recolour) in admin (v0.49.0)
- [x] Calendar view mechanics: day view is a time grid too; now-line tracks
      the current time (admin colour); grids anchor to the earliest event and
      follow the clock into the afternoon; manual scroll eases back after a
      configurable pause (v0.50.0)
- [x] Link SPORT calendar events to workouts: an event type flagged "sport
      workout" auto-logs a SPORT workout for that person on the event's day,
      recurring practices included (v0.51.0) — calendar epic complete
- [x] Calendar UX (v0.56.0): drag the day/week grid to pick a time range that
      pre-fills the new-event form; person-filter avatars moved below the grid;
      the calendar page shows only calendar items (to-do lists removed).
- [x] Sport-event completion, part 1 (v0.57.0): a "sport workout" event no
      longer auto-logs — it prompts the person on their dashboard card ("did you
      do it?"). Yes logs the SPORT session; No is a per-person, per-occurrence
      SportSkip so it never nags again or touches another person/day. Recurrence
      is handled by keying on the occurrence date.
- [x] Sport-event completion, part 2 (v0.58.0): a sport-workout event can carry
      multiple people via an EventParticipant join; the event form shows a
      "who's going?" picker for sport types, and each participant gets their own
      prompt. Empty picker falls back to the owner, so older events are
      unchanged. Prompts remain per-person, per-occurrence.
- [x] Sport-attendance rework (v0.371–0.377): the prompt reaches **everyone** on
      the event, not just the owner — the owner, every added participant, and
      **every member subscribed to a sport-flagged team calendar** (added kids
      included). Subscribed sport calendars get attendance prompts and icons too,
      once the feed is flagged as **sport in admin**. Confirming logs the event's
      **real duration** (not a one-minute stub). Unanswered prompts **persist up
      to 7 days with the day shown** instead of vanishing after the day. Related
      calendar-visibility changes shipped alongside: non-participant subscribed
      events render **grey** (under custom colours), and **newly added calendars
      default visible** to everyone (opt-out) rather than hidden — except school
      work. The calendar also loads instantly from stored events while subscribed
      feeds refresh in the background (v0.377).
- [x] **Time model, settled (v0.521–0.526)** — events store real instants; the grid
      DTO flattens them into per-day segments *and* carries the event's exact
      bounds (`startDayISO`/`startMinExact`/`endDayISO`/`endMinExact`), so the
      editor always opens the whole event. Midnight is 00:00 of the next day (never
      23:59); `1440` is a layout boundary only. An invalid interval disables Save
      and reddens the offending field. Architecture is closed — see DECISIONS.md.
- [x] **All-day events, inclusive dates (v0.524–0.526)** — a one-day all-day event
      shows the same start and end; multi-day all-day events keep their full span;
      storage still uses an exclusive end (last day + 1). Both clients have Starts
      and Ends fields, and flipping the All-day switch normalises the dates/times.
- [x] **Web all-day cosmetics** — the web form shows inclusive dates (v0.521–0.526),
      and since v0.696 an end before the start turns the end red and keeps Save
      off, the app's rule (`timeInvalid`).
- [x] All-day events shade their whole day column in a light tint of their
      colour, decided per event: a "Shade this day" box on the add-event form
      and a per-person "shade this birthday" toggle. Several shaded events on one
      day split the column into side-by-side colour bands (v0.62.0, replacing the
      global switch from v0.61.0)
- [x] Adding an event takes a duration (15 min–3 hr, or a custom end time), and
      a custom event type can carry a default length (e.g. hockey = 90 min) set
      in Admin → Calendar that fills in automatically when the type is picked
      (v0.61.0)
- [x] Calendar events are interactive: a tap highlights one; a long-press
      (tablet) or right-click (desktop) opens an action menu. Two-finger scroll
      frees a single finger to select, so the grid no longer scrolls under one
      finger. The menu's actions are Copy (opens the add form pre-filled as a
      duplicate to re-place) and Delete; an Edit entry is stubbed for the next
      phase (v0.60.0)
- [x] New-event UX (v0.68.0): a tap/click drops a default-length block (set in
      Admin → Calendar, 30 min default), a mouse drag lengthens it, and its
      right-click / long-press menu has "New appointment". All-day events are
      right-clickable too (edit/copy/delete), and a multi-day all-day event keeps
      its length when edited
- [x] Sidebar calendar layout (v0.70.0): a "New event" button, a page-able mini
      month navigator, and the person/family filters live in a left side panel;
      the schedule area is wider/taller. Grid clicks floor into the clicked
      half-hour; drags lengthen in 15-min steps from a fixed start
- [x] Day view: a column per person side by side (heading = the person's name
      pill), so everyone's day is visible at once. All-day events span the top of
      every column; shared "Family" timed events span across all columns; adding
      from a person's column fills them in as owner. Week view keeps overlapping
      lanes (v0.71.0). The person/family filter now drives which columns show,
      and columns resize to fill the width, so two people can be lined up to
      compare; a multi-person event appears in each member's column, so dropping
      one member removes only their copy (v0.72.0)
- [x] All-day Family events wash their whole day column in a light tint of the
      family colour — the pill still sits at the top in the all-day row, only
      the hours behind it are painted; birthdays don't trigger it. Same release
      fixed the afternoon grid anchor, which silently never followed the clock
      on load because it ran before the current time was known (v0.59.0)
- [x] Custom event types — parents add named types (with a colour) from Admin →
      Calendar; the event form's "Type" lists them and events take the type
      colour (v0.43.0). Admin can rename, recolour (full colour picker), or
      delete any custom type. The event form now lists custom types inline in
      the Type dropdown alongside the built-in kinds, with no separate "Custom"
      heading (v0.73.0). "Other" was dropped from the built-in list — add it as
      a custom type if ever needed (v0.74.0)
- [x] Family calendar colour accepts any custom hex, not just presets (v0.43.0)
- [x] Family-owned subscribed calendars: a subscribed (ICS) feed can belong to
      the shared Family identity ("Family (shared)" in the subscribe form)
      instead of a person, so its whole feed shows for everyone in the family
      colour; person-owned feeds still take the owner's colour (v0.73.0)
- [ ] Make the Family filter an independently togg(le)able owner, and add
      holidays as a second Family-category source

## Work

- [x] Work shifts as calendar events with hours
- [ ] Shift entry designed for the job rather than as a generic event
- [ ] Hours totals per week and per pay period

## School

- [x] Independent work as tasks with due dates but no time (v0.84.0)
- [x] Assignments and tests added by a student or a parent (v0.84.0)
- [x] Prompt on the daily page to add upcoming work (v0.84.0)
- [x] Admin School page to see and manage everyone's work (v0.84.0)
- [x] School section page + top-nav icon — shared read-only view of everyone's
      open assignments and tests, built to host classes/terms next (v0.85.0)
- [x] Tracked but unscored for now — School stays out of the score until the
      scoring rework (v0.84.0)
- [x] Classes with fixed times on the calendar — a class with meeting days and a
      time generates a recurring CLASS event automatically (v0.86.0)
- [x] Terms and class schedules managed by an admin (Admin → School) (v0.86.0)
- [x] Assignments grouped under a class — optional class link on each item, a
      class picker in the add form, grouped display on the School page (v0.87.0)
- [x] Editing a class in place — change name, term, colour, or meeting schedule;
      the linked calendar event is updated, created, or removed to match (v0.89.0)
- [x] Shared class event for two+ students as one calendar block — a class
      meeting can add other students as participants; it renders once across
      their columns instead of duplicating per student (v0.90.0)
- [x] Read-only metrics page — per-student completion, on-time, and overdue,
      broken down by class, scoped to a selectable term or all time (v0.88.0)
- [x] Window vs date-specific school work — window items (homework/projects)
      show from a start date (default today, settable ahead) until done;
      date-specific items (tests) only on the due date; overdue work persists
      either way (v0.91.0)
- [x] Subject pool — a class takes its name from a reusable Subject pool managed
      in Admin → School (like the chore master list); pick one or type a new one
      inline. Renaming a subject renames its classes; existing names/subjects
      seeded into the pool on migration (v0.92.0)
- [x] Class type — an admin-managed pool (Homeschool, Church, Dual credit…)
      shown as a label on each class; groundwork for filtering and the prompts
      below (v0.92.0)
- [x] Multi-user class membership — shared classes are now real membership
      (owner + shared students are members); any member can file work under a
      shared class, shared classes show on each member's School card, and a
      class can be shared with no meeting time. Backfilled from existing owners
      and participants (v0.93.0)
- [x] Semester rollover — when a term's end date passes with no newer term, an
      admin reminder in Admin → School opens a "new semester" form: name and
      date the next term (pre-filled to follow the last), and tick which prior
      classes to recreate (subject, type, colour, students, meeting carried over
      and re-anchored). Snooze + settable reminder interval (v0.94.0)
- [x] School work on the calendar (markers) — a "School work" filter places
      pending assignments/tests/homework/projects on the calendar by due date,
      one shared colour, timed when a due time is set else all-day, off by
      default (v0.95.0)
- [x] School work on the calendar (badges) — per-type icons (homework,
      assignment, test, project); work due on a day its class meets rides the
      class block as one badge per student with work due, dropping off on
      completion; other work shows as its own marker (v0.96.0)
- [x] Calendar item detail overlay — one click on an event opens a detail popup
      beside it (edit / duplicate / delete-with-confirm / close), showing
      category, owner, time and recurrence; a class meeting lists the work due
      that day by name and student; subscribed/birthday/school-work items are
      read-only. Replaces right-click and long-press (v0.98.0)
- [x] Detail popup in month view — month chips open the same click-to-open
      detail popup as week/day (v0.99.1)
- [x] Event background images — per-kind/holiday background art on the event
      block and detail popup, dark scrim for legibility, graceful when a file is
      missing. Drop JPGs into public/event-bg/ (see README there) (v0.99.2)
- [ ] Per-event / game-vs-practice background images and an upload picker
      (current plumbing keys off kind/holiday and reads from public/event-bg/)
- [x] Post-class prompt — after a class meeting ends, each member is asked on
      their card whether they attended (recorded) and whether work was assigned
      (any type → adds the item, linked to the class). Per-class, default on with
      an admin off switch; waits until the meeting ends and lingers until
      answered (most recent unanswered meeting first, 14-day window) (v0.97.0)
- [x] School counts toward scores, with its own per-category weekly line —
      each assignment or test done on time, no difficulty weighting (v0.106.0)
- [x] Admin → School: assignments/tests are **editable** (title, type, subject or
      class, due date), not just deletable

### Curriculum planner (complete and in use)

Turn a curriculum (a book's lessons, a list of assignments, a test schedule)
into dated schoolwork, spread across the school days of a term, per student. All
intake is **self-hosted text — wizard, paste, or CSV — no PDF/AI in the app**
(data stays on the server; Claude formats a PDF into clean CSV in a chat, the app
only parses). School days = weekdays minus household PAUSE events + holidays.

**Locked spec — three stages (all built):**
- **Stage 1 — build each class.** Wizard *or* CSV → auto-spread across the term's
  school days → review/reorder → **publish class** (generates the SchoolWork
  rows). Cross-semester ("both") classes spread across the whole year; each
  term-build locks the slice inside its own dates — split at the calendar
  boundary, never divided by hand.
- **Stage 2 — compile a term.** Combine all of a student's published classes into
  a day-by-day term schedule (one item per weekday across subjects, heavy days
  highlighted, drag to redistribute) → **publish term**.
- **Stage 3 — re-open on change.** Adding/editing a class later re-opens the
  affected term as a **draft** (keeps manual tweaks, highlights what changed,
  nothing hits the cards until re-publish).

**Behind/catch-up model:** items are fixed to dates; overdue accumulates; an
on-demand "extra per day to finish by term end"; admin re-distribute. Grades:
completion for lessons/assignments, tests keep a score. Generated work lands
under **School** on each kid's card; a schoolwork card shows overdue + today +
"get ahead".

**CSV (grain auto-detected):**
- *shorthand* — `student,class,subject,term,perDay,weekdays,startFrom,unitNoun,
  unitCount,unitSize,testsAfterLesson` (tests `;`-separated; `startFrom` like
  `L9`; term `fall|spring|both`).
- *expanded* — `student,class,subject,term,perDay,weekdays,startFrom,seq,label,
  type,load` (grouped by student+class).
- Optional on either grain: `startDate` (YYYY-MM-DD) — the day scheduling begins
  (v0.382); blank = start today. `fit` (yes/true) — front-load to finish by term
  end (v0.384). Both also editable on the review screen.
  Multi-part days go in the expanded `label` (e.g. `Read pp. 21-22; Ex. 1; Ex. 2`);
  a scored quiz/test is its own row with `type=test`.

**Shipped:**
- [x] **Data model + schedule builder (v0.378):** `ClassPlan` + `ClassPlanUnit`
      (migration 97); the verified `plan-builder.ts` (`expandShorthand` +
      `spreadUnits` + `sliceByTerm`). Algorithm verified on a real
      pre-algebra course (student P1) (156 items, from Lesson 9 → 147 scheduled; Fall ends ~Lesson
      70; finishes ~Apr 21). No screens yet.
- [x] **CSV intake (v0.379):** `plan-csv.ts` parser, `class-plans.ts` import
      action, `class-plan.ts` preview query, and the Admin → School "Curriculum
      plans" UI — paste CSV → draft plans with the computed per-term schedule
      (per-term item counts + projected finish).

- [x] **Review/reorder + publish-class (v0.380):** open a draft plan
      (`/admin/school/plan/[id]`) to drag/renumber units, skip done ones, and tune
      per-day / weekdays / both-terms with a live recompute; publish generates one
      `SchoolWork` per scheduled unit (lessons = window items, tests date-specific).
      Also added CSV **file-upload** alongside paste, and the schedule now skips
      enabled holidays (not just PAUSE days). Registered the `97_class_plans`
      migration that had been missing from the manifest.
- [x] **Stage 2 — term compile (v0.381):** Admin → School "Term schedule" →
      `/admin/school/term/[termId]/[studentId]`. Lays a student's published term
      out day-by-day across all subjects, flags days heavier than their usual
      daily load (+ a distinct 2+-tests flag), and lets you move items to another
      school day (tap-then-tap or drag) and publish the rebalanced dates. Because
      class-publish already writes work to the cards, "publish term" here
      **rebalances in place** (writes each moved unit + its Task/SchoolWork date) —
      no separate term draft/publish gate. Coursework-only classes are fully
      supported (heavy flag is count-based, not test-based).

**Next to build (in order):**
- [x] **School-year setup (v0.386):** `/admin/school/year` wizard defines Fall/Spring
      (+ optional Summer) terms and planned breaks (new `SchoolBreak` table; winter
      break = the gap between Fall end and Spring start), shows weeks per semester,
      and re-opens to edit or to add another student's classes. Breaks feed
      `noSchoolDaysFor`. Full class delete (`deleteSchoolClass`) removes the class,
      plan, generated work, members and check-ins.
      *Next for this area (Phase 2):* the month-strip **calendar view**
      *(v0.387 empty windows; v0.388 stacked per-semester rows that wrap (no
      scroll), DD-MMM-YYYY + name hovers, green final school day, planned breaks
      in a distinct tentative colour, all-day vacation end-date fixed)* —
      still to do here: classes coloured per-subject on the calendar with
      past-term overflow in red *(v0.389: per-student class overlay + red
      overflow; holiday "no school" picker also shipped)*; admin reorg into
      buttons/sections *(v0.390: /admin/school is a hub \u2192 School year, Terms &
      classes, Curriculum & schedule, Open work)*; then the dynamic reconciliation.
      *v0.391: student School card on the home page (overdue + today + per-subject
      projected finish vs the finish-by = Spring-end target + get-ahead) shipped.*
      Still to do: get-ahead **shifts remaining work earlier** so a plan re-fits
      as you work ahead *(v0.392: completing get-ahead work re-spreads the class's
      future units earlier; overdue/today untouched)*; overdue never auto-shifts
      (admin override / extend Spring only); planned break ⇄ real vacation
      **linking + reminders** *(v0.393: reminder banner before an unconfirmed
      planned break \u2014 confirm keeps it, cancel removes it and reclaims the days;
      a break covered by a real vacation is auto-skipped)*. *v0.394: adding a
      vacation that overlaps the school year prompts shift-work-off (default) vs
      keep-school-on, remembered per vacation; all-day vacation end-date fixed in
      scheduling too.* Dynamic-scheduling phase complete.
- [x] **Wizard form (v0.395):** Curriculum & schedule has a "Build a class" form
      (student/term/days/start + numbered-lessons or a typed list with TEST: lines)
      that creates a draft plan, no CSV needed. Paste + file-upload still there.
- [x] **Stage 3 — re-open for change, at the plan level.** A published plan is
      reopened with `unpublishClassPlan` (back to `ClassPlanStatus.DRAFT`), edited
      on the review screen, and republished; `rescheduleAllPublishedPlansForward`
      keeps the remaining work moving. The term-level draft/published gate
      originally sketched here was **not** built and is not wanted — Stage 2
      rebalances in place, and unpublish → edit → republish covers the case.
- [ ] **Schoolwork card** (overdue + today + get-ahead) and **admin bulk-mark**.
      *Get-ahead shipped (v0.383):* the person dashboard shows a "Get ahead in
      school" card — pick a subject, see the next upcoming item, complete it
      early; steps through future items per subject. *v0.384:* quizzes/tests from
      a published plan are eligible too (self-paced courses); standalone
      hand-added tests stay excluded.
- [x] **Catch-up / finish-by-term-end (v0.384):** `fitToTerm` on a plan
      (`spreadUnitsFit`) front-loads extra items onto the earliest school days so
      a plan that wouldn't fit at one a day lands on the last term day instead.
      Toggle on the review screen (live recompute) or `fit` column in the CSV.
      Still open: a chosen finish-*date* target and even (non-front) distribution.

(Reuses the existing school model: `Term`, `Subject`, `SchoolClass`,
`SchoolWork`, `ClassMember`, `ClassCheckin`.)

## Calendar &amp; holidays
- [x] Built-in US/Texas holidays — computed from rules for any year (no feed, no
      year-end cutoff), toggled per-holiday in Admin → Calendar → Holidays,
      shown as shared-colour all-day items. The owner's list on by default (v0.99.0)
- [x] Detail popup in month view — month chips open the same click-to-open
      detail popup as week/day (v0.99.1)
- [x] Event background images — per-kind/holiday background art on the event
      block and detail popup, dark scrim for legibility, graceful when a file is
      missing. Plumbing shipped; drop JPGs into public/event-bg/ (v0.99.2)
- [ ] Weather on the calendar — daily conditions and temps (the dashboard panel
  is under Dashboard)
- [ ] Moon phases displayed on the calendar

## Workouts
- [x] Workout card pop-out: the opened panel scales up and pulls into focus
      from the tapped side, with the resting card's action icons held softly
      out of focus (v0.29.0)
- Dropped: a shared-element animation where the tapped tile itself grows into
  the open card (visual polish only)
- [x] Add a workout from the card — one-off log; the type drives the metric
      (running→distance, rowing→meters, rucking→distance+load, weights, HIIT),
      and names default to the type (v0.30.0)
- [x] Log more than one workout a day — each is its own named session, shown in
      a per-day list you can remove from; added the Rucking type (v0.31.0)
- [x] Delete a logged workout — from the day's list, or from a "Recent workouts"
      list for past days, in case something was logged by mistake (v0.32.0)
- [x] Admin-owned, categorized exercise pool (like the chore master list), with
      weights grouped by muscle — built and managed on the Workouts admin page
      (v0.34.0)
- [x] Pool-driven logging — the "Log workout" flow picks the exercise from the
      pool and records the set against it (v0.35.0); the legacy "Log weights"
      surface and per-person "add a lift" panel are now folded into the unified
      sheet (v0.37.0)
- [x] Structured plan builder — pick category → (weights: muscle group) → choose
      pool exercises → per-exercise "log a metric?" toggle → add another workout
      to the day; people pick from the pool instead of free-typing (v0.36.0).
      Stores PlannedExercise rows (poolExerciseId + tracked + metric) — the
      backbone the completion flow below reads
- [x] Unified log sheet — one "Log workout" button on the card (no gear, no
      binary "worked out"): today's scheduled workouts shown first to complete
      with their metrics, then a "log something else" one-off from the pool
      (v0.37.0)
- [x] Complete-with-metrics — completing a planned workout pops a form asking
      only its tracked metrics, logs a pool-referenced session, and marks the
      day done (v0.37.0)
- [x] Planned rest days — schedule a weekday as rest from the plan category
      dropdown; no workout prompt is generated for it (v0.41.0)
- [x] Opened card matches the tile layout (avatar + 3-across Plan/Log/Rest),
      slightly wider (v0.41.0)
- [x] HIIT/CrossFit named workouts — a pool of named workouts built from HIIT
      movements, of a type (For time / For reps / AMRAP / Stations / Timed
      stations / Pyramid):
      - [x] Phase 1: admin builder + shared pool (v0.44.0)
      - [x] Phase 2: pick a named workout by name when logging ("log something
            else" dropdown with a "New workout" option on top); log each type's
            result
      - [x] Phase 3: pick a named HIIT workout in the weekly plan (v0.46.0)
      - [x] Phase 4: per-user pool + share → admin-approval workflow; each
            person's own HIIT workouts visible/editable under them in admin
            (v0.47.0) — HIIT/CrossFit workouts complete
- [x] HIIT extras — Tabata type; drag-reorder movements while building; movement
      input auto-detects (run → distance, weighted → reps+weight); rename pool
      items with a pencil (v0.48.0)
- [x] Weights units set per muscle group in the pool (lb/kg each); global
      measurement system removed (v0.39.0)
- [x] Admin cleanup: person drill-down shows only logged workouts; pool creation
      labelled "Muscle group" with a per-group unit switch (v0.39.0)
- [x] Per-person progress graph on the opened card (above the buttons), pool-based
      and reflecting today's planned muscle group/exercises (v0.40.0)
- [x] Chart point hover pop-up: a small card beside the point, at once; tap on a phone (v0.692)
- [x] Comparative graphs across people for the same pool exercise or workout
      (v0.38.0) — Compare section on the Workouts page, a line per person of
      best-per-day for a chosen pool movement
- [x] Admin: open a person from the Workouts page to see their exercises, plan,
      and logged workouts, and delete any individually — for clearing test or
      mistaken records (v0.33.0)
- [x] Running logs in meters or miles (track work), an Instructions field on
      named workouts (shown in Browse instead of the movement list), and Browse
      split into Workouts / Hero WODs tabs (v0.83.0)
- [x] Full edit for named (HIIT/CrossFit) workouts — Edit loads a workout into
      the builder for changes to name, type, cap/pyramid, movements, and the
      Hero WOD flag (Admin → Workouts). Log picker groups named workouts as
      Personal / Shared / Hero WOD; HIIT category reads "HIIT/CrossFit" (v0.82.0)
- [x] Hero WOD flag on named workouts — a checkbox when building a workout and a
      toggle on existing ones (Admin → Workouts); flagged workouts show a badge
      in Browse. The genre tag anticipated when Kalsu was added (v0.81.0)
- [x] Browse workouts — a button on the workout card lists the named workouts
      (HIIT and other multi-part sessions, with type and movements), shared
      library plus the person's own; simple single pool movements are excluded.
      Read-only browse for now; a home for future named types (iso, stretching)
      as they're modelled (v0.80.0)
- [x] Workout on the dashboard opens the log step — tapping a workout on a
      person's dashboard opens the same log pop-up as the Workouts page (complete
      the scheduled plan workout with its metrics, or log a one-off), scoped to
      that prompt's own day so a carried-over workout logs against the day it
      belonged to. Replaces the plain checkbox (v0.79.0)
- [x] Named workout on the dashboard prompt — a workout task reads the day's
      top planned workout name (e.g. "Leg day") instead of a bare "Workout",
      derived at read time so it renames carried-over prompts too and follows
      plan edits; "Workouts" stays as the category line. Plan-less schedule days
      keep the plain label (v0.75.0)
- [x] Configurable workout expiry — missed workouts expire like chores, on a
      household-wide window set in Admin → Workouts: 0 days (retire the day
      after due) up to "Until next due", which holds it until the same weekday
      comes round again (pure succession). Defaults to "Until next due"
      (v0.75.0)
- [x] Workout plans: optional end date (plan expiry); no end date is fine too (v0.686)
- [x] Household pause (vacation) also pauses workouts — no workout prompts
      generated for anyone on covered days, so nothing shows as due or overdue;
      logging stays open for the record, and workouts resume the day after the
      break (v0.76.0)

A personal training log, not an assigned routine: each person defines their
own exercises, optionally schedules them, and records what they did.

- [x] Per-person exercise definitions with unit, implement, and a tracked flag
- [x] Weightlifting end to end — basics as one-tap adds that drop off once used
- [x] Schedule an exercise by weekday, or just log it once
- [x] Weekly workout plan: named workouts per day, several per day, copy a day
- [x] Dashboard-style layout with a tap-to-open full view per person
- [x] Card flow: log the plan, log a new workout, or take a rest/skip day
- [x] Rest/skip marks the day done but is set aside from scoring
- [x] Pause a plan or give it an end date, with reminders to resume or renew
- [x] Binary "worked out today?" on the dashboard; logging completes it
- [x] Log the weight and reps actually done; unfinished is fine
- [x] Progress graph — a coloured line per tracked lift, with a legend and
      show/hide toggles
- [x] Measurement system in admin, with per-exercise unit override
- [x] Running and rowing (single-metric graphs) — the Cardio card
- [x] Sport, stretching, isometric
- [x] HIIT / Crossfit — user-defined workouts with a result
- [x] Major muscle groups on weightlifting workouts — per-group progress blocks,
      the body map, and "No group" for lifts like the deadlift (v0.545–0.556)
- [x] A pool of HIIT / Crossfit workouts (timed, intervals, stations) to draw
      from when building a plan
- [x] Multiple sets per exercise
- [x] Concept2 (rower) import, web v0.614.0. Other devices later.
- Dropped: a read-only household progress overview in Admin — covered by the
  Workouts page's cards, Compare, and Admin → Exercise's page per person

### Workouts rework (planned)

Progress beyond the heaviest set, so lighter weeks, other workouts and
injuries don't read as going backwards. Phases, in order:

- [x] 0. Workout export: Admin → Workouts downloads plans, movements, HIIT
      workouts, every logged set and the workout tasks as JSON (v0.606.0)
- [x] 1. Analyse the export; propose programs and a starting library; mock up
      the new logging flow (plan kept in the project docs: workouts-plan)
- [x] 2. Every-set logging: day page in sections → one movement's sets; last
      time's sets as greyed hints, never typed over; add, remove (confirm if
      saved) and shift sets; Skip / Calculator (use for set N) / Log; week
      strip and late logging. Web v0.607.1 + v0.608.0 (another-day picker,
      phone API); phone v0.414.0
- [x] 3. More kinds of progress: records by rep count with new bests, effort
      and a "something hurt" area after a movement, rep-range chart lines with
      tap labels, weekly training with weeks in a row. Web v0.610.0, phone
      v0.418.0. Session intent (light days drawn hollow) moved to 4, where
      programs plan the light weeks.
- [x] 4. Programs: templates that write the plan (strength waves with a light
      week, sets of 10 with a test week, in-season full body, just get moving,
      maintain); target weight and reps per set; end-of-block raise/repeat;
      light and test days drawn hollow; the invite. Web v0.611.0, phone
      v0.419.0. Conditioning and kettlebell programs wait for the library (6);
      a "Change" for today's set type waits for the plan builder.
- [x] 5. Suggestions, never automatic: day cards (back after a break, a recent
      hurt, workouts that felt hard → a lighter day at 80/90%), movement cards
      (swap around a hurt area, the next weight, a stalled lift), big-jump
      note, the program invite on the home page. Web v0.612.0, phone v0.420.0.
      Hockey-aware and balance rules need game detection and movement tags (6).
- [x] 6. Household equipment with weights, movement tags (type, equipment,
      ladders), a starting library shipped as data with a how-to for each
      movement, and ⓘ wherever movements are picked. Web v0.613.0, phone
      v0.421.0. The finisher builder moved to the conditioning release (it
      needs EMOM and timers), along with the named workouts library.
- [x] 7. Concept2 Logbook sync with each person's own token: connect on the
      profile (web) or Settings → Concept2 (phone); rows land in the day's
      Cardio, replace a hand entry with Undo, never doubled. Web v0.614.0,
      phone v0.422.0. SkiErg and bike results wait for categories of their own.
- [x] 7b. Cardio and Warm-up as plan categories, the day's section order
      (every day or per day), set structure per movement in a hand-built plan
      (incl. a 5/3/1 wave), and "how did it feel" for cardio and sport. Web
      v0.615.0, phone v0.423.0.
- [x] 9a. Conditioning, part 1: the timer for every format (get ready, tones,
      vibration, screen awake), EMOM, the planned workout's card with last
      result, household best and how it felt. Web v0.616.0, phone v0.424.0.
- [x] 9b. Conditioning, part 2: Pick one (filters, the named-workouts library
      with how-tos and Rx/Scaled versions, younger users on Scaled), Build one
      (finisher builder from household equipment), Write your own on the day,
      the monthly benchmark offered after a month. Web v0.617.0, phone v0.425.0.
- [x] 8. Export and import for everyone: a workouts file (plan, own workouts,
      optionally everything logged) to keep or move, imported as Replace or
      Add; share a plan with the household through a parent's approval.
      Web v0.618.0, phone v0.426.0.

## Game time

Monitoring only — the old allowance/token model was **retired** (Sep 2026). Time
is pulled automatically and shown for awareness, not enforced. A standalone
collector container is the only thing holding game-service credentials; it pushes
resolved daily totals to Kairos. See the collector repo's `README.md` /
`DECISIONS.md` for the source-side design.

- [x] Automatic collection: Xbox (via Home Assistant), Steam (official Web API),
      Microsoft balance (Family Safety) → collector → `/api/v1/game-time/ingest`
      (service-token auth, idempotent upsert, day breakdown replaced authoritatively)
- [x] Online-authoritative Xbox time, coalescing, `in_game`+`now_playing` games,
      `last_online` end cross-check, in-progress sessions counted
- [x] Steam-primary merge (union of Steam + non-overlapping Xbox) for PC kids
- [x] Postgres history: `GameDay` / `GameDayTitle` / `PlayerCard`; daily / weekly
      / monthly totals + top games
- [x] Web `/games` + app Game time screen: household list, zoomed overlay with a
      Sun–Sat bar chart, status (gamerscore / Game Pass / Microsoft balance /
      gamerpic). App: parents tap a card for detail; a child sees their own
      detail as the main view
- [x] Per-system Xbox/Steam icon per person, automatic from the collector
- [x] PC app usage through Family Safety: the collector's `ally` source reads the
      Family Safety `applications` sensor and credits only allowlisted apps
      (`GAME_APPS`) — app-open time at ~5-minute resolution, lowest precedence
- [x] Minecraft Java — decided 13 Nov: no server will be hosted, so partial
      tracking is accepted. App-open time via `ally` on a managed Family Safety
      PC when `GAME_APPS` lists the launcher; untracked on a shared or
      unmanaged PC. Exact play times (server log / RCON) are not pursued.
- [ ] Play through the Xbox app on a shared family PC doesn't surface reliably
      in Home Assistant; probably no sensor-based fix

## Groceries

- [x] Shared shopping list, added to from the dashboard by anyone
- [x] Stores to shop at (Costco, the grocery store), extendable by an admin
- [x] A learning catalog: adding an item remembers it with an icon, and the
      common ones surface first as quick picks
- [x] Icons guessed from the item name, remembered and admin-editable
- [x] Type-ahead add: matches from the catalog appear as you type, or add a
      brand-new item in one tap
- [x] Adding an item asks which store in a pop-up (no store drop-down); the
      item's usual store is offered first, and with only one store it's skipped
- [x] Fixing a catalog item's name or icon in admin also corrects the lines
      already on the list (a line mirrors the catalog, it's not frozen history)
- [x] Admin edits flash green to confirm they saved
- [x] On a personal device the signed-in person is logged as the requester;
      unassigned on the shared hub (the assignee drop-down is gone)
- [x] Two clear modes on one page — a **list** (add things, grouped by store,
      each store with its own "Shop" button) that becomes a per-store shopping
      **trip** (see below)
- [x] A live got/total progress bar while shopping
- [x] A typed item's store defaults to its remembered catalog store
- [x] Non-grocery stores handled the same way — a "store" is just a shopping
      destination (clothing, hardware) with the same cart flow
- [x] Admin: full editing of stores (rename, icon, hide, delete-when-empty)
      and catalog items (rename, icon, default store, hide, delete)

### Reorder, move between stores, and a dedicated cart (done)

- [x] Drag a handle on each saved line to reorder it within its store, or drag
      it onto another store to move it there (persisted as a `sortOrder`, added
      in migration 70). Uses the same native-drag pattern as the other reorder
      screens; touch drag on the shared tablet/phones can be revisited if it
      proves fiddly.
- [x] The shopping checklist lives on its own page (`/groceries/shop/[storeId]`)
      rather than sharing the main page with the add box and store overview.
      The dashboard line and a store's trip both open it; it's interactive for
      the shopper on their own device and read-only for everyone else.
- [x] Dropped the separate "Drop trip" — "Complete trip" with nothing ticked
      returns everything to the list, which is the same outcome.

### Shopping trips (done)

Each store is its own trip, started before you leave; the list stays intact
until the run is finished:

- [x] Tapping **Shop** on a store asks *who is shopping* (tap a profile) and
      opens a trip for that store assigned to that person
- [x] A **shopping line on that person's dashboard card**, tapping it opens
      their cart — the cart only opens on the shopper's own personal device;
      the shared hub and everyone else see who's shopping and their progress
- [x] A trip that isn't going to happen is closed with **Complete trip** and
      nothing ticked — everything returns to the list (no separate Drop button)
- [x] While shopping the **whole list stays visible** — checked items show as
      done, not gone — until **Complete trip**
- [x] Items added by anyone while a trip is live **join that trip**
- [x] **Complete trip**: purchased items drop off, unpurchased ones return to
      the saved list for next time
- [x] One trip per store (a unique constraint), so two people can shop two
      stores at once without carts crossing

### Custom icon set (done, v0.510–0.521)

- [x] A custom **`kairos:<slug>`** icon set — ~226 colourful PNGs covering the
      items and stores emoji handle badly (produce and cheese varieties, cuts of
      meat, seafood, canned goods, prepared meals, drinks, household and personal
      care, and the store types). Bundled in the web repo under
      `public/grocery-icons/kairos/` and in the app as `drawable-nodpi/grocery_*`.
- [x] A **searchable icon picker** in the grocery and store admin (type "feta",
      "juice", "pharmacy"), pools defined as `GROCERY_ICON_LIBRARY` /
      `STORE_ICON_LIBRARY`; a pasted emoji still works.
- [x] **Stores** use the same tokens and the same renderer as items, so a store
      shows its picture on the board, in the cart and in the add-to-store picker.
- [x] Name matching prefers a specific custom icon over a generic emoji, and
      **Re-sync catalog** upgrades an item to a custom icon when one now exists
      (an icon deliberately locked or already custom is left alone).
- [x] **Every custom-icon item is offerable when adding** (v0.528.0 / app 0.338.0):
      all 244 `kairos:` items are listed alongside the household's catalog with
      their canonical names, so a new item is picked (spelled right, right icon)
      rather than typed. They are suggestions, not catalog rows — nothing extra
      for "Re-sync catalog" to merge.
- [x] The monochrome **`mdi:` set is retired** — see DECISIONS.md, which also
      records the token contract, the 📦 fallback, the 8-character truncation bug,
      the server-before-app shipping rule, and the icon-sheet slicing pipeline.

### Later

- [x] **Quantities on an item** (v0.529.0 / app 0.339.0) — an optional 1-99
      count per line, set from the `#` button on the web list or the box beside
      an item while editing on the phone; the line then reads "Distilled water
      × 10" on the board, in the cart and on the phone. No quantity renders
      exactly as before. Free-text amounts ("2 dozen", "a bag") are still not
      supported — the column is an integer on the line, deliberately kept out
      of the item name so the catalog and icon matching are unaffected. — the note field exists on a line but
      isn't surfaced in the add form yet
- [ ] Recurring staples that re-add themselves on a cadence

## Scoring and gamification

- [x] Running totals: assigned, chores, completed, missed
- [x] Scoring start date so a testing period can be excluded
- [x] Summary page with leader and tie handling
- [x] Admin-only chore effort weighting on a 1-5 scale (lockable) and a
      per-person balance table, so workloads can be evened out by hand
- [x] Weighted, fair scoring: a per-person completion ratio — effort finished
      over effort assigned — so everyone can reach 100% and being handed more or
      harder work can't sink them. Chores carry their 1-5 effort; workouts,
      Bible and school are flat; a one-off task can take an admin weight. Shown
      per category and combined, week-to-date and month-to-date (v0.106.0)
- [x] Streaks: one perfect-day streak across all assigned work (chores,
      workouts, Bible, school, tasks). It breaks only when something actually
      expires unfinished — being late but catching up never breaks it, and a
      rest day with nothing due is neutral. Counts from the current scoring
      window, so a reset starts it over (v0.107.0, reset behaviour v0.108.0)
- [x] Weekly leader indicator (live) and a monthly winner crowned at month end,
      with tie handling for co-winners (v0.107.0)
- [x] Badges: perfect week, perfect month, monthly win, and streak milestones
      (7 / 30 / 100 days); the whole-Bible badge already existed. Derived from
      completions within the current scoring window, so a reset clears them for
      a clean start (v0.107.0, reset behaviour v0.108.0)
- [x] Get ahead: do an upcoming scheduled chore early for a slight,
      effort-scaled bonus — flat however early, and you can only get ahead when
      you're next up for that chore (no jumping someone's turn). Plus a
      promptness bonus on up-for-grabs shared chores: full the day it's
      available or before, half a day later, nothing after. Bonuses are the
      tiebreak that separates a board sitting at 100% (v0.108.0)
- [ ] Admin control to tune the bonus sizes (they ship as sensible constants)

### Seasons (RPG progression)

Kid feedback: they'd rather level up themselves than compete against each
other. So the competitive scoreboard became a personal-progression RPG, with
the fairness engine above as the quiet fuel. No one is ranked against anyone.

- [x] Character level and XP that only ever climb; per-category stats (Chores,
      Strength, Wisdom, Scholar, Life) that level independently, giving an
      emergent class (Athlete, Scholar, Sage, Homesteader, All-Rounder). The
      Summary is now per-kid character cards, not a leaderboard (v0.109.0)
- [x] Season tier ladder (10 tiers) that refills each month: your own completed
      work carries everyone to "season complete"; the top tiers come from
      initiative, so going beyond reads as a higher tier, not an over-100%
      score. Monthly rollover refills the season; levels and stats persist;
      a hard reset starts the whole RPG over (v0.109.0)
- [x] Personal bests (best week yet), mastery titles earned by repetition
      ("Master of Dishes"); the head-to-head monthly winner retired (v0.109.0)
- [x] Season planner: a read-only admin projection of how fast everyone levels
      at the loaded workload, with completion-rate and length what-if knobs and
      a recommended length; season length made configurable (calendar month or
      fixed multi-week) so a lighter workload can run longer (v0.110.0)
- [x] Account types: Child vs Parent, kept separate from the admin permission,
      set in Setup — the foundation the kid-focused co-op features scope to
      (v0.111.0)
- [x] Family co-op meter: one shared bar the household fills toward a family
      reward, unlocking only when every child reaches an admin-set participation
      floor (a slider with a Season-planner-fed recommendation) — nobody behind
      anyone. Reward voting: anyone proposes, everyone votes (tap-your-face
      kiosk poll), a parent selects the season's reward and grants it once the
      meter fills. No money — the reward is the real-world family thing you
      honor (v0.112.0)
- [x] Companions (engine, first creature): a starter companion that evolves
      through three stages with your character level, its card glowing with your
      skill-blend colour, with a gentle non-punishing mood. Built end-to-end
      against one creature (Coincroc); the roster is a config list (v0.113.0)
- [x] Class and companion colour from your "signature" — what you do above the
      family baseline in each area — so universal work (daily Bible) is the
      floor everyone shares and only going beyond the norm differentiates you
      (v0.114.0)
- [x] Test scores: mark a test done, enter a score out of a total; a higher
      score feeds the Scholar stat, so doing well (not just finishing) lifts
      School toward being your focus (v0.115.0)
- [ ] More quality signals feeding the signature: workout progress (e.g. the
      heat map's progress scoring) into Strength, reading beyond the plan into
      Wisdom. Today Strength mostly counts that you worked out
- [x] Companion starter variety + roster (3 creatures across eras) so people
      don't all share one; class bug fixed (no false "Athlete"); pixel XP bar
      showing level progress grouped by domain colour (v0.116.0)
- [x] Companion collection (incubate → hatch → choose): everyone starts as an
      egg that fills from XP and hatches; pick a new (never-duplicate) creature
      or deepen the current one (shiny); rarity scales with season tier; active
      companion evolves on its own tenure; reset starts everyone over as an egg
      (v0.118.0)
- [x] Collection gallery: every creature by era, owned or a silhouette still to
      find (app `GalleryScreen`, `/api/v1/characters/collection`); an owned one
      can be made active again (v0.576 / app 0.383). Minted keepsakes keep the
      stage they reached (`mintedStage`).
- [ ] Lighter collect mechanic for a 50+ roster: streak/token/coin currency to
      earn or buy eggs; essence banked from would-be duplicates toward a chosen
      creature; egg-era selection
- [x] New eras' art: all seven eras (Modern, '80s/'90s, Arcade, Dragon, Vintage,
      WW2, Imaginary) are in — 52 creatures
- [ ] Season tier rewards: cosmetic unlocks only for the individual track —
      avatar flair and evolving companions, no money (storage)
- [ ] Year-end reward, then the year is archived

## Pauses and vacations

- [x] Pause with a date range, a type, and a name (Admin → Calendar) (v0.66.0)
- [x] Generates a multi-day all-day calendar event that shades its days
      (multi-day all-day events now span every day, not just the first) (v0.66.0)
- [x] No chores due during the pause; they resume the day after (v0.66.0)
- [x] Paused days leave the scoring denominator rather than counting as misses —
      falls out for free, since scoring counts actual task rows and a paused day
      generates none, so partial weeks/months are handled without special code
      (v0.66.0)
- [x] A pause also pauses workouts — no workout prompts on covered days for
      anyone (v0.76.0)
- [x] A pause also pauses anytime and pool (shared) chores, not just scheduled
      ones — the current-period anytime task steps aside and shared chores defer
      past the break, both resuming the day after (v0.77.0)
- [x] Past-due chores and workout prompts already sitting on a card when a pause
      is set are cleared too, not just the days still ahead — the forward-only
      generators never revisited past days, so a sweep handles them (v0.78.0)
- [x] Each person's dashboard card and page show a "Paused for <trip>" note
      while a break is on, so a clean card reads as intentional (v0.78.0)
- [x] Bible reading intentionally keeps going through a break — it is not part
      of what a household pause silences
- [x] Paused banner at the top of the Chores page while a pause is active,
      mirroring the workout card's paused note (v0.77.0)
- [x] Per-person pause: pause one person's workouts and chores for a date range
      (a person's own from Workouts, v0.678/0.680; Admin → Calendar → Vacations
      & pauses for one person's chores and workouts, v0.688)
      (e.g. one kid away at camp) while the rest of the household carries on —
      the household pause stays the all-of-us case

## Tasks and appointments

- [x] Add a task for anyone, with a due date
- [x] Cancel out of the add form
- [x] Tasks are plain to-do items, without a category
- [x] Add appointments to the calendar
- [x] **Admin → Tasks** page: every one-off task in one place; a pencil edits the
      whole list — rename, re-date, reassign to another person, or delete
- [x] Web Tasks page + app Tasks screen (assign, complete, per-person)
- [x] Recurring tasks (done: `src/lib/tasks/recur-rule.ts`, v0.668)

## Interface

- [x] Material-style pill buttons with state layers and tablet-sized targets
- [x] Icon navigation
- [x] One navigation control per page
- [x] Tabular figures for every number, time, and date
- [x] Persistent top bar: page name, plus every section reachable from every
      page without returning to the dashboard
- [x] Fixed icon positions so the bar never reflows between pages
- [x] Current section shown by a larger, filled, coloured icon
- [ ] Motion on the bar: icons that grow and settle on selection, a sliding
      indicator that travels between them, and page content that transitions
      rather than snapping
- [ ] Icon badges — overdue count, unclaimed chores, unread plan days
- [x] Dark mode (app per-device + web from Admin → Appearance)
- [ ] Large touch tiles on each person's page for exercise, school, and
      reading
- [ ] Phone layout for the week grid
- [ ] Phone layout throughout — the top bar behaves differently on narrow
      screens and each page needs checking on a handset

## Offline-first (potential — not committed)
- [x] **Lighter cache-first pass shipped (app v0.204–0.209).** In-session instant
      return via **in-memory per-section snapshots** (calendar view-keyed +
      pager-seeded; chores/tasks/groceries/reading/school/bible; Money excluded;
      cleared on sign-out) + **cache fallback** when the server is unreachable
      even if the phone reports online + a **thin top background-refresh line**.
      NB: the mechanism is snapshots, **not** nav-state preservation — the
      original 0.204 save/restore-navigation-state attempt broke navigation
      (stuck on the first-visited page, incompatible with the shared section
      route) and was reverted in 0.205. Don't reattempt nav-state preservation
      without first giving each section its own nav destination (app DECISIONS.md).
- [x] Room (on-device SQLite database) as the durable source of truth for
      screen data on Android. Repositories would read the local DB instantly and
      refresh it from the API in the background, so every screen — including a
      cold start after the app is killed — renders immediately from last-known
      data and updates when the network responds. Large change (an entity + DAO
      per screen, ViewModel/repository rewrite, migrations), so do it
      incrementally, calendar first, only if **cold-start** latency still bothers
      us after the lighter cache-first pass above (which covers in-session instant
      navigation but not a fresh cold start from a killed process). (done as a Room page cache: `data/local/KairosDatabase`, `PayloadCacheDao`; every screen paints from it, cold start included)

## Onboarding
- [ ] First-run setup wizard for a brand-new Kairos: create the first person
      (the admin), optionally set a shared admin PIN (PIN is optional), and add
      the rest of the household — so a fresh install has a guided path instead
      of dropping you into an empty dashboard

## Security hardening
- [x] Brute-force protection: wrong admin-PIN and wrong login-password attempts
      are now rate-limited (in-memory fixed window, best-effort for a single
      container). Blunts a kid working through combinations. v0.176 adds a
      per-source-address ceiling on top of the per-account limit.
- [x] v0.176 hardening batch (from third-party review + own audit):
      - Secure flag on `fd_user` / `fd_admin` / `fd_mode` cookies, driven by
        forwarded proto (TLS terminates at Traefik/Cloudflare) or `COOKIE_SECURE`;
        default off so LAN-HTTP sign-in still works.
      - Admin read-window closed at the edge: middleware verifies the signed
        `fd_admin` cookie on every `/admin` navigation, so a lapsed unlock
        redirects immediately instead of lingering to the next hard load. Unlock
        TTL trimmed 8h -> 4h.
      - Avatar uploads validated by magic bytes, not just the claimed MIME.
      - CSRF: `serverActions.allowedOrigins` configurable via `ALLOWED_ORIGINS`.
      - Nodemailer bumped 6 -> 7 (CVE); lockfile synced.
- [x] **v0.280.0 hardening batch (from a source review, verified first):**
      - Calendar feed **SSRF guard** — subscription fetches refuse private/loopback/
        link-local addresses, re-check each redirect, and cap the body size.
      - Mobile-auth throttling no longer relies on a spoofable forwarded IP: a
        **secondary limit per account / code / device** backs the per-IP one, and
        `cf-connecting-ip` is preferred (with a `REAL_IP_HEADER` override).
      - **Bounded** the in-memory rate-limit map (prune expired, cap size).
      - **API auth made structural**: `withDeviceAuth` wrapper + a build-time
        route-inventory check (`scripts/check-api-auth.mjs`) that fails the build if
        a new `/api/v1` route isn't guarded or explicitly public.
      - **lastSeenAt** written at most every 15 min, not per request.
- [x] Cookie signing secret: confirmed. Both the admin unlock and personal
      sessions are HMAC-signed with a 32-byte secret generated on first use and
      kept in `AppSetting` (`sessionSecret`), not a weak default — a fresh
      install mints its own.
- [x] Code-level threat review (13 Nov): two medium and seven low findings,
      all fixed in 0.699 (see DECISIONS). Dependencies patched first (0.698).
- [x] Threat model / internet exposure: closed 13 Nov. HTTPS via the tunnel,
      `/api/v1` self-authenticated with revocable device tokens, sign-in
      required on every web page (0.699), and rate limits on every sign-in
      path.
- [x] Session lifetime / auto-lock: admin locks after a set time with no admin
      activity (5, 15, 30 min, 1 or 4 hr; Admin → Settings → Device, v0.696).
      Opening an admin page or tapping on one pushes it back; the page goes to
      the PIN screen when it runs out. (Personal sessions are deliberately long
      — a phone should stay signed in.)
- [x] Per-device session revocation: personal sessions are stateless, so
      "sign out everywhere" is currently all-or-nothing via `credentialVersion`.
      A Session table would allow listing and revoking individual devices —
      worth it once the phone app is real. (done for phones: `Device` rows, Settings → Devices with Revoke; reachable since app 0.501)
- [x] **App offline support (BIG)** — shipped across the app: read-through HTTP
      cache; a durable DataStore write queue that replays on reconnect (5xx/network
      retried, 4xx dropped); optimistic UI on chores, tasks, school, reading, bible,
      groceries, money, calendar, and workout logging, each re-derived from the
      queue on load so changes survive navigation/restart; a structural "reload the
      visible screen whenever the queue changes" net so a queued change always shows;
      and add-then-delete offline cancels both. Multipart (avatar) uploads stay
      online-only (can't be queued as text). Two-way calendar edit was the stated
      later phase and is effectively covered by the optimistic calendar work.
      Original spec:
- [x] **App offline support (BIG — high priority, its own dedicated effort).**
      The app must be usable without a signal for the shared, read-mostly surfaces.
      Today every screen fetches live over the Cloudflared tunnel, so a dropped
      signal shows a spinner and nothing loads (the calendar is the worst offender).
      What it needs:
        * On-device cache (Room, or DataStore for small state) of fetched payloads
          so screens render last-known data instantly, including fully offline.
        * Read-through pattern: show cache first, refresh from the network in the
          background, reconcile.
        * Optimistic writes with an offline queue that flushes on reconnect, for the
          on-the-go actions: marking chores done, workout done/rest, grocery check-off
          (once groceries exist), sport/class attendance answers.
      Priority scope: (1) calendar VIEWING offline — the top ask; (2) chores toggle;
      (3) grocery check. Two-way calendar EDIT sync is a later phase. Not a quick fix.
- [x] **App UI consistency — pop-ups & dropdowns.** The remaining stock
      `AlertDialog`/`Dialog` call sites were converted to the house `AnimatedDialog`
      across HomeScreen, AppRoot, the bible wizards, calendar, and the workout
      create/edit + wizard confirms. Original note:
- [x] **App pop-ups added since that conversion**: all 43 stock `AlertDialog`s
      in 22 files now use `AnimatedDialog` (app 0.503.0), whose content shrinks
      first so its buttons stay on screen.

## Pending — app parity (from the Sept web run, v0.318–0.333)

- [x] **App UI for subscribed-event reminders** (verified 13 Nov: `setSubscribedReminders`
  in the app's CalendarScreen) — the server side is live (migration
  88 `locationOverride`, `/notifications/upcoming` includes external-with-reminders,
  `saveSubscribedExtras`); the app sets per-event reminders on a subscribed
  feed. (Reminders on subscribed feeds are app-only by design; the web
  editor was removed.)
- [x] **App class form parity** (verified 13 Nov in `CalendarAddClassScreen`; the one-time
  pop-up when switching a new event's type to Class was not found and stays open) — the app's class creation matches the web's
  rebuilt class form (Subject combobox, Student, Type, Shared-with/Reminders, Meets-on,
  Start/End/Runs, Class type, Semester, Color, homework).
- [x] **App class-form + share-with layout** — the app's Shared with leaves out the
  student (verified 13 Nov).

## Shipped — Sept 23–24 2026 run (web v0.458–0.483, app v0.271–0.287)

- [x] **Reading goals, end to end** — schema + migrations 107/108, goal segments with
  `startPage`, `/api/v1/books/goals`, per-book progress calc, "Book reading" section on
  the person page + app home, book reminder setting. App book form rebuilt as a
  full-screen screen (not a Dialog) with an add-goal overlay + date picker.
- [x] **Workout** — overdue backfill + sport-completes-task fix, home workout summary
  button/card, `workoutOverdue` in the dashboard. App plate-calculator "Use this weight"
  now writes back to the originating card (target survives nav via `rememberSaveable`).
- [x] **Companions** — babies grow on clean days, streak-driven egg rarity + pity,
  gallery shows real stage, egg cap 3/month with a "hatch next month" message.
  *(The monthly cap was removed in v0.574 — growth paces hatching now.)*
- [x] **School catch-up note** — the "Do N a day…" pace note stopped showing for
  behind subjects. Fixed in app 0.288: the home screen's school detail had lost it.
- [x] **Monthly framing + Scoring & rewards admin page** — season→month wording,
  admin-only scoring-start and days-to-finish controls.

## Shipped — Sept 25–29 2026 run (web v0.495–0.526, app v0.288–0.335)

- [x] **Offline-create identity, finished** — create endpoints return the new id
  (v0.495) and de-duplicate a retried create by its client id, calendar events and
  recurring tasks included (v0.496–0.497).
- [x] **Workout plans** — weekly plan and rotation run concurrently and are each
  pausable (v0.508–0.509); stopping a rotation keeps it (v0.505); optional future
  start date for a weekly plan, web and app (v0.506–0.507); no more false overdue
  backlog after editing a plan (v0.502/0.504).
- [x] **Grocery + store icons** — the `kairos:` custom set, picker, matcher
  improvements, store icons everywhere, `mdi:` retired (v0.498–0.521).
- [x] **Calendar time model** — exact bounds in the DTO, midnight as next-day
  00:00, inclusive all-day dates with Starts/Ends on both clients, All-day toggle
  normalisation (v0.521–0.526).
- [x] **Docs brought back in step with the code (29 Sep)** — the icon system and
  the calendar time model are written up in DECISIONS.md (web + app), the calendar
  surface is documented in `docs/API.md` along with a full endpoint inventory, the
  app ARCHITECTURE theme section was corrected, and the collector roadmap was
  re-baselined.

## Shipped — Sept 30 – Oct 14 2026 run (web v0.527–0.581, app v0.336–0.389)

- [x] **Groceries** — quantity per line (v0.529, migration 115), 30 more icons and
  the full icon set offered when adding (v0.527–0.530).
- [x] **Dashboard for a given day** — tomorrow's page carries tomorrow's numbers
  (v0.531–0.532).
- [x] **Companions** — deepen no longer costs a monthly hatch (v0.534); then the
  progression rework: growth to adult before an egg, deepening as a phase, no
  monthly cap, shiny ≠ grown, growth banked on the shelf and resumed from the
  gallery, one bar broken at stages (v0.574–0.578, migrations 120–121).
- [x] **Profiles** — display name is parent-only (v0.535).
- [x] **Workouts** — skip a missed day from Overdue (v0.536); reps (v0.537);
  same-muscle plans share a card and swaps work on the web (v0.538–0.540,
  migration 116); lift detail views, involvement table and held movements
  (v0.541–0.546); progress from history, "No group", body map (v0.547–0.552);
  Compare as bars, shared gridlines (v0.553–0.556); completion by identity, not
  label (v0.558); prefill and edit of today's log (v0.559–0.562); `completedOn`
  due-day vs done-day (v0.563–0.564, migration 117); one logging function on
  both clients (v0.566–0.567); the history block (v0.568–0.570); per-movement
  logging (v0.579).
- [x] **Family goals** — carry across months with parent approval (v0.565); one
  vote per person per month, movable, and the home card stops asking once
  you've voted — parents are asked to pick instead (v0.583 / app 0.393,
  migration 122).
- [x] **Shared chores** (v0.584 / app 0.394, migration 123) — "Available for"
  covers always-open chores too (hidden and refused for people off the list);
  a per-chore Turn reminder list keeps people in the pool without ever flagging
  them; the app home card calls out "Your turn"; the web Shared chores names
  open the list of completions behind each count.
- [x] **School** — plan-unit completion sync + backfill (v0.571–0.572, migration
  118); extra-work picker fix, original due dates, red behind tint (v0.573,
  migration 119).
- [x] **Calendar** — notes on Events / Medical, per-person filing from the phone
  (v0.580 / app 0.387–0.388); import a single event from an `.ics` file on both
  clients (v0.581 / app 0.389).
- [x] **Docs brought back in step (14 Oct)** — ROADMAP, README, ARCHITECTURE,
  docs/API.md and DECISIONS on the web; README, DECISIONS, ARCHITECTURE and
  RELEASING on the app; README, DECISIONS and ROADMAP on the collector.

## Open — agreed, not built yet

- [x] **Companion profile icons** (web 0.582 / app 0.392) — in the app's gallery,
  tap an owned companion → Use as profile picture → pick a stage you've reached.
  Phone-only to choose; shown everywhere. See DECISIONS.
- [x] **School catch-up note** — fixed in app 0.288 (see above).
- [x] **Offline** — done on the phone (app 0.292–0.313 and since): every
  screen paints from the Room page cache and works offline; offline writes,
  calendar events included, queue and replay with temp-id correlation. Gap:
  a calendar day never opened while online shows a "not synced yet" note.
- [x] Full-body moves (v0.696): lifts get the muscle that drives them (cleans,
  snatches, thrusters → Legs; clean and press → Shoulders; Turkish get-up →
  Core; mid-thigh pull → Back), and conditioning moves logged as sets
  (burpee, bear crawl, jump rope, slams, wall ball, throws) add minutes to the
  endurance heart. Mobility (inchworm, world's greatest stretch) stays out.
  Grouped charts squashing a light lift: gone since every lift has its own
  chart (v0.670).
- [x] Remaining sets −5 / 0 / +5 control removed: app 0.502.0, web v0.696.

## Scoring rework (web 0.603 / app 0.411)

- [x] Partial days count (share of the day's list finished), today live and
  drawn lighter; family goal and "This month" count the same days of work;
  egg luck from the last 14 days' completion; Life from confirmed team sport;
  bar colours from what earned the growth; scoring snapshot shows the real
  rules; "How scoring works" on web and in app Settings. docs/SCORING.md.
- [x] Calibrate growth pace and egg rarity against real data (13 Nov, from the
  scoring snapshot at Admin → Settings → Scoring & rewards; replaces the old
  "calibrate incubation XP" line, since incubation XP became growth in 0.603).
  Target agreed: an egg about every 3 weeks, rares feel about right.
  - The children doing their usual work (about 60–75% of each day's list) earn
    4.3–5.2 growth a week, so an egg every 2.3–2.8 weeks. That's on target, so
    nothing changes: still 12 to adult (and 6 more to deepen) and a +2 perfect
    week.
  - At 100% with perfect weeks it is 9 a week (an egg about every 1.3 weeks),
    which is the parents' pace.
  - Egg luck at that completion is 0.3–0.5: rare or legendary about 16–22% of
    hatches, against 8% with no luck and 36% at full luck. Kept.
  - Family goal: at that pace a child ends the month with 18–22 days of work,
    so 15 means finishing about half the list. Kept at 15.
  - Re-check if the workload changes a lot.

## Hockey (web 0.600 / app 0.409)

- [x] **Hockey page** — stick & puck, drop-in, parent & child and youth open
  hockey for the next 7 days with sign-up counts, from the separate ice-time
  container (Admin → Hockey). Add to calendar pre-fills New event.
- [x] **Hockey layout per person** (web 0.601 / app 0.410) — sections start
  collapsed; open/closed and the order set with Arrange are saved per person.
- [ ] ice-time: follow the rink's schedule index page to pick up each July's
  new links (tracked in the ice-time repo).

- [x] The day's "+ Conditioning" becomes "+ Additional": a picker for
  conditioning, mobility, stretching or isometrics, added to that day only
  (web 0.667 / app 0.477).
- [x] Adjust today, Hurt: a stand-in for each move left out, from recent lifts
  (v0.675), so a day emptied by the area becomes a day for the healthy parts.
- [x] Pause for an injury: weeks with a sore area don't cool its groups on the heat map (v0.686).
- [x] Workouts page: nine buttons (v0.684 / app 0.494); Workout days draws three
  or more kinds as pie slices, tap a day for the breakdown (v0.681–0.683).
- [x] Heat map earned by progress and easing back (v0.689–0.690,
  `training-heat.ts`); carries mapped to arms, core or shoulders (v0.690).
  A map toggle and stars were both rejected.
- [x] Companion lifts step up only after Easy, by the movement's step;
  dumbbells and kettlebells step through the sizes owned (v0.694).
- [x] Full pages for anything you search, fill in or step through, on both
  clients; no pull-up sheets (web 0.680–0.684 / app 0.490–0.492).

From the original workouts plan, not built yet:
- [x] "Something hurt?" marked on the body map for that area (sore spots, v0.675).
- [x] Planned light weeks shaded on the lift charts (web 0.670 / app 0.480,
  with lift rows and a page per lift).
- [x] Cardio charts (v0.674) (reached from the Endurance heart and a Cardio section on
  the Workouts page; bar charts carry dates under them like Weekly training):
  per activity, this week / best / 30-day pace tiles,
  distance per week, pace per session (faster higher, dots by effort), best
  marked. Mockup agreed.
- [x] Conditioning charts (v0.674): sessions, new bests, sessions per week, and each
  workout done more than once with its results over time. Mockup agreed.
- [x] Family WOD (v0.679): a parent picks a day's workout and who's in; others
  join; a board per WOD; anyone suggests one for a parent to approve.
- [x] Smarter suggestions: hockey-aware rules, push/pull balance, and a "plan
  too big" nudge (v0.676).
- [x] Swap a leg day with another day that week around a game (v0.677).
- [x] Workout pauses (v0.678): a household pause pauses everyone's workouts
  (prompts, missed days, heat map, plan-too-big, suggestions); a person's own
  pause for being sick, injured or other, from their Workouts menu. Range
  calendar, Vacation and planned-ahead pauses (v0.680–0.684); an admin pauses
  one person from Admin → Calendar (v0.688, migration 152).
- Dropped for now: "Keep N sets" on a movement; a weekly lift order that rotates.

## Known-good baselines (end of this run)

- Web APP_VERSION 0.705.0 on Next.js 16.4.6 (migrations through 154_class_plan_paused, all registered
  in `MIGRATIONS` since 0.695).
- App versionName 0.505.0 / versionCode 577 / CLIENT_BUILD 577.
- ice-time 0.1.3 (no Extra Parameters needed on Unraid).
- Collector 5.0.0: deployed and running; Xbox totals come from real game sessions,
  plus the `ally` PC source where `GAME_APPS` is set.
