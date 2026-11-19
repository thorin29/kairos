# Roadmap

**Open** below is the one list of agreed work that isn't built yet. An item is
checked off and moved into "Built" in the same release that ships it. Every
other section describes what exists today.

- Why things were built the way they were: DECISIONS.md (web and app).
- What each release changed: `CHANGES` in `src/lib/version.ts` and the app's
  `CHANGELOG.md`.

Nothing here contains household data. Plans, chores, names and schedules all
live in the database, never in this repository.

---

## Open

1. **Import a personal Bible plan by pasting it.** Done since v0.723:
   Bible → your plan → Import takes dated lines, or passages with a start date
   and weekdays (`POST /reading/plan/import`, `scope: "mine"`), on the web and
   the app. Kept here only until it's confirmed and removed.
2. **"Read today?" nudge** on the dashboard person card for someone with a
   leisure book in progress. Kept for now.
3. **Game vs practice backgrounds.** A sport event picks its standard image by
   Game, Practice or Other (for example `hockey-game.jpg`,
   `hockey-practice.jpg`), shipped in `public/event-bg/` like the rest. No
   upload picker.
4. **Moon phases on the calendar.**
5. **Weather on the calendar** (web only): each day's conditions and high and
   low.
6. **Weather panel on the dashboard** (web only): current conditions, high and
   low, an icon for the time of day and sky, and the moon phase.
7. **Weekly forecast page** (web only), styled after Breezy Weather.
8. **PC play time.** A small program on the PC reports what was played and for
   how long, for PCs that Family Safety doesn't cover. The ROG Ally is already
   covered (collector 5.0.0, the `ally` source).
9. **Badges on the Characters page.**
    - Finishing your grade or the year's school work, at the end of the school
      year.
    - Working out over long stretches: 3 months, 6 months, 1 year, 2 years and
      on.
    - Reading through the Bible (the tracker's times read), shown with the
      character as well as on the Bible page.
10. **Archive a finished school year.** Once the school year is complete, its
    schedule and school work move out of the everyday lists and pickers so
    they don't clutter them; still readable, nothing deleted.
11. **Ice-time: find each season's schedule links** on the rink's index page
    instead of pasting them in each July. Tracked in the ice-time repo.

## Not doing (decided)

Kept here so they don't come back as open items.

- Workout progress feeding Strength. Strength counts workouts done (Nov 2026).
- Memory verses (Nov 2026).
- Season tier rewards. The tier ladder isn't shown; badges cover it (Nov 2026).
- Archiving the whole year, and a year-end reward. Only the school year is
  archived (Nov 2026).
- A finish-by date for curriculum plans; fitting to the term end covers it
  (Nov 2026).
- A note on shopping items; quantities cover it (Nov 2026).
- An upload picker for event backgrounds. Backgrounds are standard images
  (Nov 2026).
- Smooth animated chore-card reordering. Drag to reorder is enough (Nov 2026).
- A pop-up when a new event's type becomes Class. The app goes straight to the
  class form.
- Push through FCM. Reminders are local. If server-triggered notifications are
  ever wanted, the path is self-hosted UnifiedPush (an ntfy container), not
  FCM.
- OIDC sign-in through Authelia. The first-party accounts are enough.
- Personal settings on the web. The web is a shared screen; personal
  settings live in the phone app (Personal mode stays an unadvertised admin
  option).
- Dropped on 13 Nov: "act as me", Kairos-side TOTP, shift entry and hours
  totals, recurring grocery staples, bonus-size tuning, a lighter collect
  mechanic, and the interface-polish and phone-layout items.
- Admin bulk-complete of Bible reading through a date.
- A term-level draft/publish gate in the curriculum planner. Unpublish, edit
  and republish a class covers it.
- A household progress overview in Admin. The Workouts page cards, Compare and
  Admin → Exercise cover it.
- A tile that grows into the opened workout card (shared-element animation).
- A heat map toggle, and stars on the heat map.
- "Keep N sets" on a movement, and a weekly lift order that rotates.
- Exact Minecraft Java play times (no server is hosted). Launcher open time
  through Family Safety is accepted.

## Versions

- Web 0.738.0 on Next.js 16.4.6 and Prisma 7.10.1. Migrations through
  160_calendar_work, all registered in `MIGRATIONS`.
- App 0.534.0 (versionCode 606, CLIENT_BUILD 606).
- ice-time 0.1.3.
- Game-time collector 5.0.0.

---

## Built

### Foundations

- One application container plus PostgreSQL, deployed from GHCR. Schema
  migrations (hand-written SQL) apply on container start.
- One task model: chores, reading, school, workouts and one-off tasks share a
  completable row, so completion and streaks are one query.
- Overdue is a read-time rule, not a rewritten due date; unfinished work
  carries forward with its original date.
- Calendar dates are kept apart from real instants. The process runs in UTC
  with a separate household timezone (`HOUSEHOLD_TZ`, from `TZ`).
- Nightly `pg_dump` into the data volume.
- About page: version, a migration completeness check, and **Export
  everything** to JSON (admin only, secrets left out; v0.733).
- Admin → **Activity**: every parent change, who made it and what changed,
  kept 12 months (v0.733).
- First-run setup: an empty database opens /setup; the first person becomes
  the admin, then the rest of the household, phone invites and the PIN.

### Access and accounts

- The web needs a signed-in **parent** on every page and server action
  (v0.699). A shared screen is signed in once and then works for the whole
  household. Children use the phone app. First run stays open until a parent
  has a password.
- Optional shared **admin PIN** on top: 3 tries per 15 minutes per device,
  bound to the PIN, auto-locks after idle time (Admin → Settings → Device).
- Invite-only accounts: a parent issues a one-time invitation (emailed when
  SMTP is set up, or shown as a code and QR). Sign in by name or email.
- Change your own password (web profile page, app Settings).
- Phone devices: per-person device tokens, listed and revocable by the person
  (Settings → Devices) and by a parent.
- Per-resource ownership: on a personal device you act only for yourself
  (`requireCanActFor`).
- Rate limits on every sign-in path; Content-Security-Policy with a per-request
  nonce; frame and nosniff headers; SSRF guard on calendar feeds; a build-time
  check that every `/api/v1` route is guarded (`scripts/check-api-auth.mjs`).

### Phone app

- Native Kotlin / Jetpack Compose, repo `kairos-app`, over `/api/v1`. Every
  web section is in the app: Home, Tasks, Calendar, Chores, Bible reading,
  Reading, School, Workouts, Shopping, Money, Game time, Ice time, Characters
  and Summary.
- Joins by scanning the invitation QR in the app (server address included) or
  typing the code.
- Offline: every screen paints from the Room page cache; writes queue and
  replay on reconnect (created items keep their identity). A calendar day
  never opened online shows "not synced yet".
- Local reminders per calendar event (subscribed feeds included), a workout
  timer that keeps running outside the app, the home-screen widget, a guided
  tour (replayable from Settings → Help & about) and in-app updates.
- Settings: profile card, Account, Look & feel (mode, nine colours, eight
  backgrounds, 24-hour clock), Notifications & reminders, Connected apps
  (Concept2), Parents, Help & about.

### Home dashboard and Summary

- A card per person with per-category completion; neutral when nothing is
  assigned; overdue work carried forward; today's schedule strip with day
  paging; "Up for grabs" for released and shared chores.
- Weeks start on Sunday throughout.
- Follow-up prompts: "Did you go?" for sport events and classes, and the Bible
  reward reminder.
- **Summary** page (v0.733), last in the menu: the family goal and a week or
  month completion grid by person. Parents see everyone, children see
  themselves. Late work counts on the day it was finished. Tap a day for its
  log.

### People

- Photo or preset icon, colour, display name (parents set names), birthdays
  on the calendar, parent and child roles.
- A companion can be your profile picture, at any stage you've reached
  (chosen in the app).
- The household order (drag in Admin → Chores) is the order people appear
  everywhere.

### Chores

- Master list, assignment by person and weekday, generated two weeks ahead;
  edits reconcile without orphaning rows.
- Expiry by succession: an unfinished chore expires when it next comes due for
  anyone, with one grace day on the missed owner's list, tinted overdue
  (v0.713).
- Release a chore for a day; shared chores claimed by whoever gets there,
  recurring a set number of days after completion, pausable for a season;
  "Available for" and Turn reminder lists.
- Always-open chores (regenerate when done), countable chores (tap each time),
  Do-anytime chores (any day in a period), collaborative chores (several people,
  done when everyone has), a rotation helper.
- Get ahead on your next chore for a small bonus.
- Drag to reorder the household; move an assignment from its card; rename in
  place; cumulative missed count; a warning for unassigned chores.

### Tasks

- One-off tasks for anyone with a due date; repeating tasks (weekly, monthly,
  yearly, every N days). Web Tasks page and app Tasks screen; Admin → Tasks to
  rename, re-date, reassign or delete.

### Bible reading

- Plans stored as data. Import a dated schedule (draft, then publish) or
  generate one: books in any order, start date, weekdays and per-weekday
  chapter counts, chapters a day or a finish date, balanced by verses, books
  kept whole, no passage twice. Preset book lists (canonical, historical,
  chronological, New Testament).
- Today's reading large with neighbouring days to swipe through.
- Add readings to a plan: additional, or inserted (pushes the plan back);
  Christmas and Easter extras that don't count toward coverage.
- Import and export plans in the same text format, family (parent) and
  personal, web and app.
- Personal reading alongside the family plan: your own plan or a manual
  checklist by chapter; it feeds Wisdom (2 XP a chapter).
- The Bible tracker (v0.724–0.730): times read per book, section, testament
  and the whole Bible, milestones and bests, bars for this time through, an
  All books page. Start over (family in Admin → Bible, personal in the plan's
  options) resets the bars and keeps times read.
- Monthly reading rewards with parent approval (settings are web admin).

### Leisure reading

- Self-only book tracker: pages and/or chapters, the page you're on, goals
  with dates, a To read / Read shelf. Feeds Scholar (2 XP a chapter or 10
  pages). A reading reminder in Settings.

### School

- Assignments, tests, homework and projects with due dates, added by a student
  or parent; window items vs date-specific tests; test scores feed Scholar.
- Classes with meeting times on the calendar, shared classes as one block,
  subjects and class types from admin pools, semesters (a class can have
  none), semester rollover, post-class "did you attend?" prompts.
- School work on the calendar as badges on the class block.
- Admin → School hub: School year (terms and planned breaks), Terms & classes,
  Curriculum & schedule, Open work; editable work; a per-student metrics page.
- **Curriculum planner:** build a class from the wizard, a pasted list or CSV;
  spread across the term's school days (skipping pauses, holidays and breaks);
  review and reorder; publish to the cards; compile and rebalance a student's
  term day by day; fit to the term end; unpublish, edit and republish.
- Catch up (v0.701): re-baseline a behind student from the next school day.
  Paused classes (v0.702) keep one open item that never goes late.
- Get ahead: do upcoming plan work early, and the plan re-spreads.

### Calendar

- Day (a column per person), 3-day, week, month and agenda views; overlap
  lanes; midnight-crossing events split across days; all-day events with
  inclusive dates and optional day shading.
- Events: appointments, classes, work shifts, birthdays, anniversaries,
  medical (with notes), custom types with colours and default lengths, sport
  types with Game / Practice / Other. Share with several people.
- Repeats: daily, weekly on chosen weekdays, monthly, yearly, custom interval,
  until a date or N times; edit or delete this occurrence or the series.
- Subscribed ICS feeds per person or for the family, with per-event reminders
  (app), sport feeds that prompt attendance, and **Work shifts** feeds whose
  events show as Work (v0.734).
- Import one event from an `.ics` file on the web or the phone.
- Built-in US and Texas holidays, toggled per holiday, with their own colour.
- Personal calendar on a signed-in device: its own view, filters and colours,
  stored on the server so the phone and web match.
- "Family events" toggles family events on their own (web and app).
- Event background images by kind and holiday from `public/event-bg/` (see
  the README there).
- Household pauses (vacations) shade their days and pause chores and
  workouts; a parent can pause one person (Admin → Calendar → Vacations &
  pauses).

### Workouts

- Plans: weekly plan and rotation (pausable, end dates, a future start),
  programs that write the plan (5/3/1, Boring But Big, 5/3/1 for Beginners,
  wave loading, Odd squad with ladders, density, carry and club finishers),
  "your version" of a program kept across switches, saved plans, export and
  import, household sharing with a parent's approval.
- Odd squad ladders move on only when the week's reps were all done; a short
  week repeats (v0.734). Garage length for shuttles, set by a parent on the web
  (Admin → Equipment) or in the app builder.
- Every set logged against last time's; records by rep count; how it felt and
  "something hurt"; bodyweight work-up hints; companion lifts that step up after
  Easy.
- A day holds warm-ups (switchable for the day), strength, core with a monthly
  plank test, arms, cardio, conditioning (timer for every format, named
  workouts with Rx and Scaled, a generator and builder, a monthly benchmark),
  mobility, stretching and isometrics with a monthly test. **+ Additional**
  adds any of them to one day. Adjust today: Low energy, Short on time, Sick,
  Hurt (with stand-ins).
- A day is complete only when every part is done or skipped.
- A movement planned on two cards the same day stays on the first card; the
  later card doesn't count it and says "Hollow hold was removed because it is in
  another workout today." (v0.736, wording v0.738).
- Suggestions that never act on their own: next weight, lighter day, swaps
  around sore spots, hockey-aware days, push/pull balance, "plan too big", leg
  day away from a game.
- Progress: body map with the training heat map (earned by progress, eases
  back), the endurance heart, a page per lift (estimated max, light weeks,
  trend, consistency), bodyweight movements by reps (v0.734), Weekly training,
  Core, Cardio and Conditioning charts, the Workout days grid, Compare across
  people.
- Family WOD: a parent picks a day's workout, people opt in, a board per WOD,
  suggestions for a parent to approve.
- Pauses: your own (sick, injured, vacation, other, up to 180 days), the
  household's, or one person's set by a parent. Paused days never count as
  missed.
- Concept2 rower sync per person (SkiErg and bike results are skipped).
- Household equipment with weights and a movement library with a how-to for
  each.

### Game time

- Monitoring only. The collector container (its own repo) holds the
  credentials and pushes daily totals: Xbox (through Home Assistant), Steam,
  and allowlisted PC apps through Family Safety (`ally`).
- Web Game time page and app screen: today, week and month, games, system
  icons, Microsoft balance.

### Shopping

- Shared list with a learning catalog, quick picks and type-ahead; 244 custom
  `kairos:` icons; stores with icons; quantities per line; drag to reorder or
  move between stores.
- Per-store trips: pick who's shopping, a line on their card opens the cart,
  items added meanwhile join the trip, Complete trip keeps what wasn't bought.
- A line can carry a note, shown when set; there is no field to type one.

### Money

- Per-person ledger with running balances (a child sees themselves, a parent
  sees the household); add a deposit or payment (pending until approved).
- Parents approve, edit, delete and set starting funds on the web or the
  phone; Bible reward payouts approved the same way.
- Web admin only: CSV import and the reward settings.

### Hockey (Ice time)

- The next 7 days of stick and puck, drop-in, parent and child, youth and
  public skate with sign-up counts, from the ice-time container. Add to
  calendar in one tap. Section order and open state per person.

### Scoring and characters

- XP and level from everything finished; skills Chores, Strength, Wisdom,
  Scholar and Life; a class from what you do above the family baseline. Rules
  in docs/SCORING.md and on "How scoring works" (web and app).
- Day credit (share of the day's list finished) drives character growth and
  "This month"; the family goal is met when every child reaches the month's
  days of work; reward proposals and voting; carried goals with parent
  approval.
- Companions: an egg, hatching (rarity from the last 14 days' completion),
  growing to adult, deepening to shiny, a gallery of 52 creatures across
  seven eras, switching with growth kept by whoever earned it.
- Streaks, perfect weeks, best week, mastery titles, badges.
- Characters page (v0.733) shows the characters; the family goal is on Summary.

### Appearance

- Nine colours, eight backgrounds (each light and dark) and System / Light /
  Dark: household-wide on the web (Admin → Appearance), per device in the app.
- One UI rule on both clients: anything you search, fill in or step through is
  a full page; small pop-ups only for short choices, confirmations, ⓘ, date
  pickers and breakdowns.
