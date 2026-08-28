# Roadmap

Everything this project is meant to do, in one place. Checked items are
built and deployed; unchecked ones are agreed but not written yet.

Nothing here contains household data — plans, chores, names, and schedules
all live in the database, never in this repository.

---

## Personal settings (per-user, non-admin)

- [ ] A settings area reached from a **settings icon in the sidebar**, shown
      when someone is signed into their own account. Distinct from the admin
      panel: these are personal preferences, not household administration.
      Icon is deliberately held back until the area exists, so there's no dead
      button in the sidebar.
- [ ] Change your own password.
- [ ] Appearance / themes — light and dark mode, plus a few colour themes, so
      the app isn't locked to the teal-green palette. Groundwork already laid:
      the sidebar colour is a single CSS variable, and the intent is to move
      the rest of the palette behind variables a theme can swap.
- [ ] Personal calendar event colours — custom colours for events when you're
      viewing your **own, not-shared** calendar. The shared view keeps whatever
      is configured household-wide; only your personal view is recoloured.
- [ ] Personal defaults (e.g. default calendar view, starting page) and other
      per-user preferences as they come up.
- [ ] Update `README.md` and `ARCHITECTURE.md` when this ships.

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

Before any Kotlin, two things settle first (see docs/API.md open questions):
the **mobile identity model** (proposed: per-person device tokens) and the
**`/api/v1` contract**.

- [ ] Confirm the identity decision (per-person device tokens vs alternatives).
- [ ] Build the `/api/v1` surface in this repo (auth/enroll, me, dashboard,
      chores, rewards, calendar, reading, workouts, companions, devices, sync,
      meta). Additive-only; business logic reused from existing server code.
- [ ] Add the Authelia `/api` bypass **only once** token auth exists
      (DECISIONS.md).
- [ ] Native Kotlin client (`kairos-app`): Compose UI, ViewModel, Retrofit,
      Room, WorkManager, FCM.
- [ ] **Push notifications** via FCM, with typed deep-link targets
      (`chore:<id>`, `reward:<id>`, `event:<id>`, `reading:<ref>`).
- [ ] **Offline** for the personal daily surface (today's chores + completion
      at minimum), replaying writes through the same POST endpoints so there is
      no separate write-sync path. Wider offline (calendar two-way) is a later
      step.

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
- [ ] **Device modes** — a device is shared/kiosk (the wall tablet, no login)
      or personal (a phone, signed in). Nothing is gated behind login yet; this
      is the next phase.
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
- [ ] **Per-resource ownership** (finer than session-level): e.g. on a personal
      device, only log your own workout. Not needed for the shared tablet, where
      acting for the whole household is the point. Revisit with the phone app.

#### Personal-view scoping (for the phone app screens)

On a personal device each page should show only the signed-in person. The data
scoping is worth doing regardless of the app; the layout tweaks are really the
phone screens. Track A (the non-personal fixes) shipped in 0.159.0; these are
the remaining personal-view items:

- [ ] #2 Home/card: open straight onto the card contents (not the summary
      tile); completeness bars at the top; drop the "personal view — {name}"
      banner and the red exclamation; surface up-for-grabs and always-open
      chores that are currently missing from the personal home.
- [ ] #4 (personal half): "This week" and "Weekly rotation" show only the
      signed-in user; keep shared chores; (always-open counts shipped in 0.159).
- [ ] #6 Reading — only your own reading.
- [ ] #7 School — only your classes, assignments, tests.
- [ ] #8 Game time — only you.
- [ ] #9 Workouts — only you, and open straight onto the workout overlay/page
      rather than a card you then tap.
- [ ] #11 Transactions — only your transactions; hide the page/menu entry
      entirely if you have no data.
- [ ] #12 Character — only you, and move the character onto this page from the
      home card.
- [ ] Calendar — "major changes" still to be specced before building.
- [ ] Kairos-side TOTP for the eventual app API path that bypasses Authelia.
- [ ] **"Act as me" step-up** on the shared tablet — attribute a single action
      to a person (tap avatar, optional personal PIN) without turning the
      tablet into a private session. The grocery "I'm going shopping → cart"
      flow now exists as a shared run; this would let a run be tied to one
      person (their name on the trip, their staples) if that ever proves useful.
- [ ] **Personal / focused views** on a signed-in device, plus a summary page
      that's one tap away rather than front-and-centre.
- [ ] Admin is still a separate axis (the shared PIN). Later: let a personal
      account carry the admin capability so a parent's login grants it directly.
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
- [ ] Rotation helper — assign one chore across several people in sequence
- [ ] Gate a collaborative chore as complete only once everyone has done it,
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
- [ ] Preset plans generated from book lists (canonical, historical,
      chronological, New Testament only) — generated here, not copied from
      published plans
- [ ] Importer: file upload, preview-before-commit, documented grammar
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
- [~] Cycle-based workouts: choose specific rest days, N-day rotations off the
      weekly grid.
      - [x] Phase 1a — rotation model + fixed rest days that pause the cycle +
            builder with 10-day preview, on each person's own workout card
            (choose Weekly or Rotation when creating a plan); scheduling derived
            at read time (v0.126.0, moved to the user card in v0.127.0)
      - [x] Phase 1b — log a workout (or rest day) for a past day via a date
            picker on the Log screen, completing that day's prompt (v0.128.0)
      - [ ] Phase 2 — expire an overdue workout when the next one for the same
            muscle group comes due (matches the main group, ignores sub-work)
- [ ] Personal Bible reading plan (alongside the family plan)
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
- [ ] Past sport event auto-logs as a workout for the selected users
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
- [ ] Personal reading plan creation: a person can build and follow their own
      reading plan alongside the shared family plan, so reading beyond the
      family minimum is possible and shows up as above-baseline Wisdom
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
- [~] Expand recurrence rules from subscribed feeds — not needed: the public
      feeds in use list every occurrence with real dates rather than a repeat
      rule, so nothing to expand. (The weekday-repeat work landed on manually
      added events instead — see the Recurrence line above.)
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
- [ ] Built-in event kinds (Appointment, Class, Work shift, Birthday) stay
      coloured by person by design, so they can't be recoloured or renamed like
      custom types. Possible future option: let an admin give a built-in kind
      its own colour, or set it to the family colour, without touching the
      per-person colouring elsewhere
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

## Calendar &amp; holidays
- [x] Built-in US/Texas holidays — computed from rules for any year (no feed, no
      year-end cutoff), toggled per-holiday in Admin → Calendar → Holidays,
      shown as shared-colour all-day items. Marco's list on by default (v0.99.0)
- [x] Detail popup in month view — month chips open the same click-to-open
      detail popup as week/day (v0.99.1)
- [x] Event background images — per-kind/holiday background art on the event
      block and detail popup, dark scrim for legibility, graceful when a file is
      missing. Plumbing shipped; drop JPGs into public/event-bg/ (v0.99.2)
- [ ] Weather on the calendar/dashboard — daily conditions and temps
- [ ] Moon phases displayed on the calendar

## Workouts
- [x] Workout card pop-out: the opened panel scales up and pulls into focus
      from the tapped side, with the resting card's action icons held softly
      out of focus (v0.29.0)
- [ ] Better card animation: the *actual card* pops out — the tapped tile lifts
      from its slot and grows into the centre of the screen as it expands,
      rather than a separate panel fading in over it (shared-element / FLIP
      transition from the card's real position to the enlarged view)
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
- [ ] Chart point hover tooltip is a native title for now; richer hover popup later
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
- [ ] Workout plans: optional end date (plan expiry); no end date is fine too
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
- [ ] Running and rowing (single-metric graphs)
- [ ] Sport, stretching, isometric
- [ ] HIIT / Crossfit — user-defined workouts with a result
- [ ] Major muscle groups on weightlifting workouts
- [ ] A pool of HIIT / Crossfit workouts (timed, intervals, stations) to draw
      from when building a plan
- [ ] Multiple sets per exercise, and estimated one-rep max
- [ ] Concept2 and other device imports
- [ ] Read-only progress overview across the household in admin

## Game time

- [x] Daily allowance per person
- [x] Weekly tokens buying extra minutes, spent on the day they raise
- [x] Admin configuration of limits, tokens, and bonus minutes
- [x] Household view and per-person tracker
- [x] Over-allowance recorded rather than blocked
- [ ] Award a token for winning the week
- [ ] Timer rather than manual logging
- [ ] Pull console/PC time automatically instead of logging it by hand
      (researched Jul 2026):
  - [ ] Steam — official Steam Web API (`IPlayerService/GetOwnedGames` gives
        `playtime_forever` and `playtime_2weeks` per game). Needs a free API
        key and the child's game-details set to public. No per-day history, so
        poll on a schedule and store the deltas. The one sanctioned, stable
        option.
  - [ ] Xbox per-game playtime — no official consumer API (Microsoft's XSAPI
        is for in-title dev use). Only via unofficial third parties like
        OpenXBL (xbl.io) or the xbox-webapi-python library; may break anytime.
  - [ ] Total screen time per child across Xbox + Windows PC — Microsoft
        Family Safety already tracks this (we have a family account), but there
        is no official API. An unofficial, reverse-engineered library
        (`pyfamilysafety`, as used by a Home Assistant integration) reads
        screen time / app usage read-only. Best coverage, but undocumented and
        breakable, and needs parent-account credentials stored securely.
  - [ ] Decide route(s), weigh the ToS / privacy / credential-storage risk of
        the unofficial ones before building

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

### Later

- [ ] Quantities on an item (2 dozen) — the note field exists on a line but
      isn't surfaced in the add form yet
- [ ] Recurring staples that re-add themselves on a cadence
- [ ] Installable on a phone as a PWA, so a shopper has the list in the aisle
- [ ] Optional native Android wrapper if a PWA proves too limiting

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
- [ ] More quality signals feeding the signature: workout intensity/volume
      into Strength, reading beyond the plan into Wisdom
- [x] Companion starter variety + roster (3 creatures across eras) so people
      don't all share one; class bug fixed (no false "Athlete"); pixel XP bar
      showing level progress grouped by domain colour (v0.116.0)
- [x] Companion collection (incubate → hatch → choose): everyone starts as an
      egg that fills from XP and hatches; pick a new (never-duplicate) creature
      or deepen the current one (shiny); rarity scales with season tier; active
      companion evolves on its own tenure; reset starts everyone over as an egg
      (v0.118.0)
- [ ] Collection gallery: a page showing all creatures owned + the silhouettes
      still to find; minted keepsakes with their frozen colour
- [ ] Lighter collect mechanic for a 50+ roster: streak/token/coin currency to
      earn or buy eggs; essence banked from would-be duplicates toward a chosen
      creature; egg-era selection
- [ ] Calibrate incubation XP and rarity odds against the Season planner once
      all events are locked in (levels/odds driven by real workload)
- [ ] New eras' art as it arrives: Dragon (7 wyrmlets), WW2 (1940s), Imaginary,
      Vintage; plus remaining Modern/'80s creatures
- [ ] Season tier rewards: cosmetic unlocks only for the individual track —
      avatar flair and evolving companions, no money (storage)
- [ ] Companions: original collectible creatures across style "eras" (Modern,
      '80s toon, arcade pixel, vintage rubber-hose B&W), drawn from random eggs;
      the skill-blend colour lives on the card frame so it works across every
      style; active companion tints live, collected ones minted; duplicates give
      shinies and essence toward a chosen one (art via ChatGPT/Nano Banana/
      Scenario, storage for the collection) — co-op raids a later opt-in game
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
- [ ] Per-person pause: pause one person's workouts and chores for a date range
      (e.g. one kid away at camp) while the rest of the household carries on —
      the household pause stays the all-of-us case
- [ ] Auto-suppress hand-added one-off tasks that fall on paused days too

## Tasks and appointments

- [x] Add a task for anyone, with a due date
- [x] Cancel out of the add form
- [x] Tasks are plain to-do items, without a category
- [x] Add appointments to the calendar
- [ ] Recurring tasks

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
- [ ] Dark mode
- [ ] Large touch tiles on each person's page for exercise, school, and
      reading
- [ ] Phone layout for the week grid
- [ ] Phone layout throughout — the top bar behaves differently on narrow
      screens and each page needs checking on a handset

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
- [x] Cookie signing secret: confirmed. Both the admin unlock and personal
      sessions are HMAC-signed with a 32-byte secret generated on first use and
      kept in `AppSetting` (`sessionSecret`), not a weak default — a fresh
      install mints its own.
- [ ] Threat model / internet exposure: the first-party password flow is now
      the "real auth" the PIN scheme was deferring, so exposing Kairos past the
      LAN is closer to reasonable — but it still wants HTTPS (have it via
      Cloudflared) plus a decision on what's reachable. The phone app forces
      this: an allowlisted APK on a child's device must reach Kairos over the
      tunnel. Revisit when device modes land.
- [~] Session lifetime / auto-lock: admin unlock is now 4h and is re-checked at
      the edge on every admin navigation (v0.176). A true inactivity auto-lock
      (rolling idle timeout) for the shared wall tablet is still open.
      (Personal sessions are deliberately long — a phone should stay signed in.)
- [ ] Per-device session revocation: personal sessions are stateless, so
      "sign out everywhere" is currently all-or-nothing via `credentialVersion`.
      A Session table would allow listing and revoking individual devices —
      worth it once the phone app is real.
