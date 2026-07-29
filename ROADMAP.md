# Roadmap

Everything this project is meant to do, in one place. Checked items are
built and deployed; unchecked ones are agreed but not written yet.

Nothing here contains household data — plans, chores, names, and schedules
all live in the database, never in this repository.

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
- [ ] PWA install and offline queueing for actions taken without signal
- [ ] **Installable Android app** — a real APK rather than a home-screen
      shortcut, so it can be allowed on a child device with a time limit and
      work where general internet access is blocked

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
- [x] Recurrence — daily, weekly, monthly, annual, custom interval, end date
- [x] Selected day shows tasks on the left and schedule on the right
- [x] Deletion rules: parents only for repeating events and birthdays
- [ ] Expand recurrence rules from subscribed feeds
- [ ] Edit an existing event
- [ ] Split events crossing midnight across both days
- [ ] Family-owned subscribed calendars: let a subscribed (ICS) calendar
      belong to the shared Family identity so its whole feed inherits the
      Family color — needs isFamily on ExternalCalendar plus feed-form and
      sync changes (Phase 2b of the Family calendar work)
- [ ] Make the Family filter an independently togg(le)able owner, and add
      holidays as a second Family-category source

## Work

- [x] Work shifts as calendar events with hours
- [ ] Shift entry designed for the job rather than as a generic event
- [ ] Hours totals per week and per pay period

## School

- [ ] Classes with fixed times on the calendar
- [ ] Independent work as tasks with due dates but no time
- [ ] Assignments and tests added by a student or a parent
- [ ] Prompt on the daily page to add upcoming work
- [ ] Terms and class schedules managed by an admin
- [ ] Read-only metrics page

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
- [ ] Admin-owned, categorized exercise/movement pool (like the chore master
      list); people select from it instead of defining their own — the
      groundwork for comparing metrics between people
- [ ] HIIT/CrossFit builder: choose a type (AMRAP / max sets / for time) and
      pull movements from the HIIT pool into one named workout with a result
- [ ] Comparative graphs across people for the same pool exercise or workout
- [ ] Admin: delete any person's workouts — pick a user in the workouts admin,
      see their logged workouts in a list, delete individually
- [ ] Workout plans: optional end date (plan expiry); no end date is fine too
- [ ] Admin: pause a person's workouts for a set period (vacations) — no plan
      tasks generated while paused

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
- [x] Filter the list by store — "I'm at Costco" shows just Costco's items
- [x] A learning catalog: adding an item remembers it with an icon, and the
      common ones surface first as quick picks
- [x] Icons guessed from the item name, remembered and admin-editable
- [x] Assign an item to a person, and check items off into a cart
- [x] Admin: manage stores and the remembered catalog, seed an initial list
- [ ] Per-person cart: "I'm going to Costco" pulls that store's items into
      one person's run, and checking off updates the shared list
- [ ] Quantities and notes on an item (2 dozen, the good kind)
- [ ] Non-grocery stores handled the same way (clothing, hardware)
- [ ] Suggest a store for a typed item from its catalog default
- [ ] Recurring staples that re-add themselves on a cadence
- [ ] Installable on a phone as a PWA, so a shopper has the list in the aisle
- [ ] Optional native Android wrapper if a PWA proves too limiting

## Scoring and gamification

- [x] Running totals: assigned, chores, completed, missed
- [x] Scoring start date so a testing period can be excluded
- [x] Summary page with leader and tie handling
- [x] Admin-only chore effort weighting on a 1-5 scale (lockable) and a
      per-person balance table, so workloads can be evened out by hand
- [ ] Streaks
- [ ] Weekly winner, by streak, completion count, or first finished
- [ ] Badges, including Bible completions
- [ ] Weighted, fair scoring: because chores differ in count and effort, work
      out a score (using the effort weights) that gives everyone an equal
      chance to win regardless of who was handed more or harder chores

## Pauses and vacations

- [ ] Pause with a date range, a type, and a name
- [ ] Generates a multi-day all-day calendar event
- [ ] No chores due during the pause; they resume the day after
- [ ] Paused days leave the scoring denominator rather than counting as
      misses, including for weeks and months that only partly overlap

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
- [ ] Brute-force protection: PIN attempts are currently unlimited — nothing
      rate-limits or locks out after repeated wrong guesses. Low stakes for a
      kids-vs-parents LAN threat model, but a real gap.
- [ ] Threat model / internet exposure: the PIN scheme is for a local network
      only ("swap for a real password flow before exposing this to the
      internet"). If Kairos is ever reachable from outside the house, PINs
      aren't enough — that needs real auth + HTTPS. A conscious decision.
- [ ] Session lifetime / auto-lock: confirm how long an unlock lasts and
      whether it should auto-lock after inactivity (a shared wall tablet argues
      for a shortish timeout).
- [ ] Cookie signing secret: confirm the admin session is signed with a secret
      from the environment, not a weak default.
