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
- [ ] Export everything to JSON from the admin panel
- [ ] PWA install and offline queueing for actions taken without signal

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
- [ ] Rotation helper — assign one chore across several people in sequence

## Bible reading

- [x] Plans stored as data, never in the repository
- [x] Import a dated schedule; draft first, publish when checked
- [x] One reading task per person per day
- [x] Coverage statistics: Old Testament, New Testament, and by group
      (Pentateuch, History, Wisdom, Major and Minor Prophets, Gospels, Acts,
      Paul, General Epistles, Revelation)
- [ ] **Plan generator** — pick books and a date range, balanced by verse
      count rather than chapter count so days stay even
- [ ] Per-weekday chapter counts, including a lighter Sunday as an option
- [ ] Guarantee no passage is scheduled twice within a plan
- [ ] Preset plans generated from book lists (canonical, historical,
      chronological, New Testament only) — generated here, not copied from
      published plans
- [ ] Importer: file upload, preview-before-commit, documented grammar
- [ ] Export a plan for editing and re-import
- [ ] **Reading eras** — statistics accumulate until an admin resets, rather
      than resetting each January
- [ ] Admin bulk-complete: mark everything read through a chosen date, for
      everyone
- [ ] Admin override for a single day across the whole household
- [ ] Badge for a complete Bible, with a count of full passes

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

## Exercise

- [ ] Per-person routines, the most flexible category
- [ ] Log what was actually done, with sets, reps, and weight
- [ ] Admin-defined programmes
- [ ] Read-only metrics page
- [ ] Logging from a phone

## Game time

- [x] Daily allowance per person
- [x] Weekly tokens buying extra minutes, spent on the day they raise
- [x] Admin configuration of limits, tokens, and bonus minutes
- [x] Household view and per-person tracker
- [x] Over-allowance recorded rather than blocked
- [ ] Award a token for winning the week
- [ ] Timer rather than manual logging

## Scoring and gamification

- [x] Running totals: assigned, chores, completed, missed
- [x] Scoring start date so a testing period can be excluded
- [x] Summary page with leader and tie handling
- [ ] Streaks
- [ ] Weekly winner, by streak, completion count, or first finished
- [ ] Badges, including Bible completions
- [ ] Handle unequal workloads fairly when comparing people

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
- [ ] Dark mode
- [ ] Large touch tiles on each person's page for exercise, school, and
      reading
- [ ] Phone layout for the week grid
