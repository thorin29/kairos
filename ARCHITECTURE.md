# Architecture

Why the code is shaped the way it is. Read alongside [ROADMAP.md](ROADMAP.md),
which covers what exists and what doesn't.

## Stack

Next.js 16 (App Router) · TypeScript · Prisma 7 · PostgreSQL · Tailwind 4

Dependencies are pinned to exact versions and installed with `npm ci` against
a committed lockfile, so a rebuild months from now produces the same image.

Deployment is a single container published to GHCR by GitHub Actions, running
alongside an existing PostgreSQL instance. Migrations apply on start, so
updating is pulling a newer image.

## The load-bearing decisions

### One task table

Chores, Bible readings, school work, and one-off tasks are all rows in `Task`,
separated by a category and optional links to detail records. Completion
percentages, overdue detection, streaks, and the scoreboard are then single
queries rather than four parallel implementations.

### Dates are not timestamps

A chore is due on a *day*; a work shift starts at an *instant*. Due dates are
`DATE` columns, events are `timestamptz`.

The Node process runs in UTC and the household's real timezone lives in
`HOUSEHOLD_TZ`. This is not cosmetic: the `pg` driver parses `DATE` columns at
the process's *local* midnight, so a process running in Chicago reads back a
stored date as `05:00Z` and compares it as greater than the `00:00Z` value it
wrote. Running in UTC makes reads and writes agree.

All date comparisons are on `YYYY-MM-DD` strings, never on `Date` objects, so
an hours-level offset can't flip one. Everything funnels through
`src/lib/dates.ts`.

### Derived state is computed, not stored

Overdue, chore expiry, and birthday occurrences are read-time rules rather
than columns written by a job. No nightly sweep to run, no backfill when a
rule changes, and no rows drifting out of sync with reality.

Overdue in particular never rewrites a due date. A chore missed on Tuesday
stays a Tuesday chore forever, which is what makes historical stats mean
anything.

### Generators reconcile, they don't append

`generateChores`, `generatePoolChores`, and `generateReadingTasks` each work
out what *should* exist across a window, create what's missing, and delete
unfinished rows that no longer match. An append-only generator leaves orphans
behind whenever a schedule is edited and nothing ever corrects them.

Two things are never touched: anything already complete or skipped, and
anything dated before today.

Chore slots are matched on the assignment they came from, not on who holds
them, so a chore released and claimed by a sibling still fills its slot.

Generation runs on page load and is idempotent, which avoids needing a
scheduler.

### Chore expiry is by succession

An unfinished chore expires the day after the same chore next comes due for
anyone — the floor only needs vacuuming once, but a miss gets one day of grace
(v0.713) to be logged, shown as overdue. Never on a timer, so a monthly chore
stays live for its whole month. Expired instances grey out and count for
nobody, but remain against their original date.

Shared chores are the exception: unassigned, claimed by whoever gets to them,
and rescheduled a fixed number of days after each *completion*.

### The web needs a parent's sign-in; the shared screen then acts for everyone

Since v0.699 every web page and server action requires a signed-in **parent**
(an ADMIN account with a password). There is no switch. A shared screen is
signed in once by a parent and then works for the whole household, so
everyone sees everything and completes their own work without identifying
themselves, as before. Children use the phone app, never the web. First run
(no admin has a password yet) stays open so setup can finish.

- **One implementation:** `src/lib/web-gate.ts` holds the rules (session
  check, first run, PIN-bound unlock). `proxy.ts` (Next 16's name for
  middleware; always Node, every request, soft navigations included) and the app (`currentUser`, `isAdmin`,
  `loginRequired`) both call it.
- **No environment needed:** the secret comes from `appSecret()`, generated on
  first use and stored in `AppSetting`; `SESSION_SECRET` only overrides it.
  `REQUIRE_LOGIN` is no longer read.
- **Admin on top of sign-in:** an optional shared PIN, a nuisance guard so
  others don't change settings, not a security boundary. It allows 3 tries per
  15 minutes per device. The unlock cookie is signed with the PIN hash, so
  changing the PIN ends every other unlock, and it auto-locks after idle time.
- **Guards in two places:** guards live in server actions, not only in the UI,
  and `proxy.ts` guards `/admin`, so a new sub-page is protected the moment it
  exists. The unlock page sits outside `/admin`, because a door can't be
  behind the lock it opens.
- **Helpers stay out of action files:** every export of a `"use server"` file
  is a callable server action. Unguarded helpers that API routes share
  (`school/structure-core.ts`, `school/plan-core.ts`,
  `calendar/subscribed-reminders-core.ts`) live in plain modules instead.

### Plans are data, generators are code

A household's reading plan lives in the database and never enters this
repository. What ships is the machinery: canon reference, passage parser,
importer, statistics, and the generator. A fresh clone gets an empty plan
builder.

The generator (`src/lib/bible/plan-builder.ts`) is a pure function with no
server dependencies, which is what lets the same code preview a plan in the
browser as the form is filled in and build the saved one on the server. The
server never accepts the preview's output — only the inputs cross the wire and
the schedule is rebuilt on arrival, so the two can't drift. The same goes for
adding readings and importing (`src/lib/bible/plan-edit.ts`): the browser
previews with the function the server saves with.

Every chapter read is a row (`BibleRead`), so counts and timing are worked
out from the ledger each time (`src/lib/bible/tracker.ts`, pure) rather than
stored: a level has been read as many times as its least-read chapter.

### Position is laid out, not scrolled to

The reading deck centres today by pushing every card sideways by its distance
from the selection, so the correct arrangement is the first paint. The earlier
version set `scrollLeft` after mount and put today hard against the left edge
whenever the measurement ran before the fonts settled. Anything that has to
measure the DOM to look right will occasionally look wrong.

### The client/server boundary is enforced

`src/lib/prisma.ts` imports `server-only`. Anything a client component imports
is bundled for the browser along with everything *it* imports, so a query
module and a constants module can't share a file — that once dragged the
Postgres driver into the browser build. Constants that both sides need live in
dependency-free modules (`src/lib/days.ts`, `src/lib/bible/books.ts`).

Enum imports used only as types are `import type`, which TypeScript erases.

### The mobile API is a second door, self-authenticated

The native phone client talks to a versioned REST surface at `/api/v1`
(docs/API.md), not to Server Actions. It is **additive** — the same domain logic
behind a second door — and is the first place per-person identity enters the
system. A phone enrolls to one `Person` and carries a bearer **device token**;
the web is signed in by a parent and acts for the household.

Two properties are load-bearing. First, only a SHA-256 of every secret is
stored — enrollment codes and device tokens alike, exactly like an `Invite` — so
a database leak yields nothing usable. Second, `/api/v1` does its own auth on
every request in the route handlers (`src/lib/api/device-auth.ts`), so it is
**exempt from the login gate in `proxy.ts`** rather than redirected to `/login`.
That per-request self-authentication is also what makes a scoped Authelia
`/api/v1` bypass safe: the app never relies on Authelia to protect it. The
public endpoints (sign-in, join, join check, forgot, recover, meta, and the
game-time ingest with its own service token) are listed in
`scripts/check-api-auth.mjs`; join and recover are guarded by one-time,
short-lived, rate-limited codes.

### A rule lives in one place; a phone copy is tested against it

Every rule that decides what gets saved or shown has exactly one
implementation on the server, and both the web pages and the device API call
it. Each of these exists because a duplicated copy had already drifted in
production:

| Rule | Where it lives |
|---|---|
| Logging a planned workout (web and phone) | `logPlannedWorkout` in `src/lib/workouts/mark.ts` |
| Logging an additional (unplanned) workout (web and phone) | `logCustomEntry` in `src/lib/workouts/mark.ts` |
| Which events a person's calendar shows, and their colors (Calendar + widget) | `personalEventRules` in `src/lib/queries/calendar-page.ts` |
| What birthday can be saved (web form + phone) | `checkBirthday` in `src/lib/birthday.ts` |
| Which timezone an event's instants are read in (all-day = UTC) | `eventTz` / `eventParts` in `src/lib/dates.ts` |
| How long each occurrence of a repeating event may last | `fitRepeatingSpan` in `src/lib/calendar/repeat-span.ts` (every save path) |
| Which kinds are yearly occasions, and which names aren't remembered | `isOccasion` / `isOccasionName` in `src/lib/calendar/occasions.ts` |
| When a shopping trip ends on its own (the day after it started) | `endStaleTrips` in `src/lib/groceries-core.ts`, run before every trip read/write |
| How pale status tints (`bg-*-50`, `text-*-700`…) look in dark mode | the `html.dark` remap block in `src/app/globals.css` |
| How long each occurrence of a stored repeating event lasts | `occurrenceSpanMs` in `src/lib/calendar/repeat-span.ts` (calendar, sport and class "ended" checks, repair) |
| Which occurrence a tapped day belongs to (overnight pieces) | `occurrenceOfRow` / `occurrenceDayFor` in `src/lib/calendar/recur.ts` (web + phone edit, delete, calendar read, repair) |
| Repairing calendar rows saved by older code | `repairEventRows` in `src/lib/calendar/repair-events.ts`, once per process before `loadRange` |
| How grocery icons look in dark mode (a light tile, pictures and emoji) | `.grocery-pic` / `.grocery-emoji-tile` in `src/app/globals.css`; the app's `GroceryGlyph` draws the same tile |
| Body map figure colours (web and app) | `--color-figure*` in `src/app/globals.css`; the app's `figureColors(dark)` holds the same values |
| A movement's Best weight / Best reps / Latest | `src/lib/queries/movement-stats.ts` |
| Schoolwork completion marks the plan unit done | `syncPlanUnitDone` in `src/lib/school/plan-unit-sync.ts` |
| Companion growth banked across a shelf trip (stays with whoever earned it, v0.697) | `src/lib/companions-tenure.ts` (banks `growth`, today included, and `deepenBanked`; the incoming one gets `tenureCreditOffset`); the offset applied in `loadProgression` (`progression.ts`); DB test `test/companion-switch.test.ts`; which companion a day or week belongs to in `src/lib/companions-growth.ts` |
| What a day is worth (growth, the month, the family goal, egg luck) | `dayCredit` and friends in `src/lib/companions-growth.ts` — map in docs/SCORING.md |
| The character's row of squares (web + phone) | `growthRow` in `src/lib/scoring/growth-cells.ts` |
| "How scoring works" text (web `/scoring` + phone Settings) | `scoringGuide` in `src/lib/scoring/guide.ts` |
| Which events take a note, and its length | `takesNotes` / `cleanNotes` in `src/lib/calendar/event-notes.ts` |
| Whose calendar a new event lands on | `resolveOwner` in `src/lib/calendar/create-event.ts` (never trusted from the request) |
| One event from an `.ics` file | `readIcsFile` in `src/lib/calendar/ics-import.ts` |
| Which companions you own, at which stage | `loadOwnedCompanions` in `src/lib/companions-owned.ts` (gallery + profile picture) |
| A family-goal vote (one per person per month, movable) | `toggleCoopVoteCore` in `src/lib/coop-core.ts` |
| What the home card says before a goal is chosen | `coopHomeNudge` in `src/lib/coop-nudge.ts` (web banner + `/api/v1/coop`) |
| Who a shared chore is available for (none set = everyone) | `loadPoolEligibility` / `isAvailableTo` in `src/lib/chores/pool-eligibility.ts` |
| Whose turn a shared chore is | `furthestBehind` in `loadOpenTasks` (`src/lib/queries/overview.ts`), honouring `PoolReminderOptOut` |
| The least growth a returning companion keeps | `bankedGrowthFloor` in `src/lib/companions.ts` (read in progression) |
| What kind of profile picture a value is | `isUploaded` / `isIcon` / `companionAvatarOf` in `src/lib/avatars.ts` |
| Whether a planned workout is done (logged or skipped) | `planDone` in `src/lib/queries/workout-log.ts` |
| Which set stands for a movement logged set by set (prefills, phone value, history, last time) | `topSet` in `src/lib/workouts/sets.ts` |
| How a day's workouts are laid out (sections, title, progress, week strip) | `daySections` / `dayTitle` / `dayProgress` / `stripState` in `src/lib/workouts/blocks.ts` |
| Records by rep count, a new best, the logger's record chips, rep-range chart lines, weeks trained in a row | `repRecords` / `isNewBest` / `recordChips` / `bandPoints` / `weeksInARow` in `src/lib/workouts/records.ts` (the phone mirrors `isNewBest` and `recordChips` in `MovementSetsViewModel`) |
| A program's weeks, set schemes and each set's target; what starting one writes | `targetsFor` / `programWeek` / `PROGRAMS` in `src/lib/workouts/programs.ts` (pure); `startProgram` / `endProgram` / `nextBlock` / `inviteFor` in `src/lib/workouts/program-run.ts` |
| The movement library, name matching when it's added, equipment | `LIBRARY` / `nameKey` / `planLibraryMerge` / `DEFAULT_EQUIPMENT` in `src/lib/workouts/library.ts` (pure); adding and the equipment setting in `src/lib/workouts/library-run.ts` |
| A day's sections and their order; Cardio shown when done unplanned | `daySections` / `cleanOrder` / `withCardio` / `blockKind` in `src/lib/workouts/blocks.ts` (pure; the phone mirrors them in WorkoutLogScreen.kt); saved orders in `src/lib/workouts/day-order.ts` |
| Which plans never make a day late (Warm-up, Cardio) | `OPTIONAL_CATEGORIES` / `isOptionalCategory` in blocks.ts, used by the task generator, `loadDayPlanProgress` and `workoutTaskTarget` |
| Zone colours and icons on Family map cards (v0.779) | `src/lib/places/zone-colors.ts` (pure), `zones-look.ts` (`zoneLook`, `noteZoneIcons`, `zonesForAdmin`), `src/app/admin/places/zone-colors.tsx`; `PlacesZone` |
| A trip's phone GPS and summary (v0.779) | `POST /api/v1/places/phone-points` (`parsePhonePoints`), `preferPhone` in `src/lib/places/day.ts`, `elevationOf` in `src/lib/places/elevation.ts` (`elevation-calc.ts` pure), `lastTrip` / trip summary in `src/lib/workouts/backpacking.ts` |
| Backpacking trips (v0.778) | `tripDays` / `dayOfTrip` in `src/lib/workouts/backpacking-days.ts` (pure), `tripEvents` / `onTripToday` in `backpacking-trips.ts`, `hikeOn` / `backpackingTick` / `startTrip` in `backpacking.ts` (timer in `src/lib/timers.ts`); `BackpackDay`; History marks hiking and Camp in `src/lib/places/history.ts` |
| A walk, run, ruck or hike tracked in the app (v0.777) | `parseTrack` in `src/lib/workouts/tracked-shape.ts`, `saveTrackedWorkout` in `tracked.ts`, `trackedCount` in `tracked-count.ts` (counted in `workoutBlocksFor`); `WorkoutTrack`; on Family map History via `withWorkouts` in `src/lib/places/workout-legs.ts` |
| What makes a Cardio or Warm-up plan done; logging cardio | `CARDIO_CATEGORIES` in blocks.ts, `loadDayPlanProgress` (solo plans); `logCardio` / `cardioDay` / `setWarmupDone` / `simplePlansFor` in `src/lib/workouts/cardio-run.ts`; activities and `parseClock` in `src/lib/workouts/cardio.ts` |
| A hand-built plan's set structure | `SCHEME_CHOICES` / `cleanPlanScheme` / `HAND_WAVE` in `src/lib/workouts/programs.ts`; targets in `movementTarget` (workout-log.ts) |
| How each conditioning format runs, its clock and sounds; the result it fills | `timerPlanFor` / `timerAt` / `cuesAt` / `resultFromTimer` in `src/lib/workouts/timer.ts` (pure; the phone's Timer.kt mirrors it); the card's results in `src/lib/workouts/conditioning-run.ts` |
| The workouts library, Rx/Scaled and who starts Scaled; Build one | `WOD_LIBRARY` / `versionMoves` / `defaultVersion` / `planWodMerge` / `benchmarkForMonth` in `src/lib/workouts/wod-library.ts`; `buildFinisher` / `cleanBuilt` in `src/lib/workouts/finisher.ts` (both pure) |
| Logging a conditioning result; Pick one; "pick on the day" plans; the monthly benchmark; adding the library | `writeConditioning` / `logNamedConditioning` / `logBuiltConditioning` / `conditioningChoices` / `pickPlansFor` / `benchmarkFor` / `applyWodLibrary` / `saveBuiltWorkout` in `src/lib/workouts/wod-run.ts`; the cards in `src/app/exercise/conditioning-picker.tsx` |
| The workouts file (export / import), household plans | `readWorkoutsFile` / `planImport` / `planSummary` in `src/lib/workouts/plan-file.ts` (pure); `exportWorkouts` / `previewImport` / `applyImport` / `sharePlan` / `sharedPlansFor` / `useSharedPlan` in `src/lib/workouts/plan-share-run.ts`; the buttons and windows in `src/app/exercise/plan-file-panel.tsx`; Admin in `src/app/admin/exercise/shared-plans.tsx` |
| Concept2 results to rows, when to sync, how far back | `mapResult` / `syncFrom` / `syncDue` / `rowSummary` in `src/lib/workouts/concept2.ts` (pure); token, ledger, replace and Undo in `src/lib/workouts/concept2-run.ts` |
| A movement's "Watch how" link | `watchUrl` in `src/lib/workouts/watch.ts` (the phone's `watchUrl` in `MovementInfo.kt` matches it) |
| Which suggestion shows, and its thresholds; a big jump; a lighter day | `daySuggestion` / `movementSuggestion` / `bigJump` / `RULES` in `src/lib/workouts/suggest.ts` (pure); answers and the day's lightness in `src/lib/workouts/suggest-run.ts` |
| Muscle groups (Deadlift included) and their labels | `MUSCLE_GROUPS` / `MG_LABEL` in `src/lib/workouts/catalog.ts`; body-map regions in `navRegionFor` (`involvement.ts`); existing deadlifts moved by migration `139_deadlift_move` |
| Warm-up and Mobility routines (library, own, a plan entry's choice; Mobility v0.659 via `kind`) | `WARMUP_LIBRARY` / `MOBILITY_LIBRARY` / `cleanSteps` / `stepAmount` in `src/lib/workouts/warmup-library.ts` (pure); `routinesFor` / `saveRoutine` / `setPlanWarmup` / `setDayWarmupSwap` + `daySwaps` (one day, v0.711) / `warmupsForDay` in `warmup-run.ts`; UI `WarmupWindow` / `RoutinePicker` / `WarmupPlanLine` in `src/app/exercise/warmup-window.tsx` |
| The workout timer's light or dark look | `usePalette` / `TIMER_THEME_KEY` in `src/app/exercise/conditioning-timer.tsx`; set in `src/app/person/[id]/profile/timer-theme-form.tsx` |
| The Summary page's completion grid and day log (v0.733) | `loadCompletion` / `completionPeople` / `dayLogFor` in `src/lib/queries/completion.ts`; UI `src/app/summary/` and `DayLogDialog` in `src/components/day-log-card.tsx`; API `/api/v1/summary`, `/api/v1/summary/day` |
| The Activity log (v0.733): which writes, who, and the row | `activity-model.ts` (followed models), `activity-context.ts` (actor: device mark or web server action), `activity.ts` (before/diff/record/prune); hooked in `src/lib/prisma.ts`; page `src/app/admin/activity` |
| Export everything (v0.733) | `src/app/admin/export/route.ts`; card on `src/app/about/page.tsx` |
| Odd squad and the block builder (v0.732): `ladder` / `density` / `carry` / `clubs` targets, a slot's `offer` list, Core day placement | `ODD_SQUAD` / `oddTargets` / `weekSchemeLabel` / `lengthsFor` in `src/lib/workouts/programs.ts`; `offer` in `loadProgramChoices`, `placeCoreDay` / `keptRotations` / `loadGarageFeet` in `program-run.ts`; UI `src/app/exercise/block-builder.tsx` |
| Odd squad ladders that repeat a short week (v0.734) | `ladderTotal` / `ladderStepAfter` in `src/lib/workouts/programs.ts` (pure); the reps per earlier week in `ladderStepFor` (`src/lib/queries/workout-log.ts`), passed to `targetsFor` and `weekSchemeLabel` |
| Bodyweight movements charted by reps (v0.734) | `bodyweightSeries` in `src/lib/queries/bodyweight.ts`, merged into the lift series in `queries/workouts.ts` and the phone's progress series in `workout-log.ts` |
| Cardio kinds and colours, picking the sport, x of y (v0.745) | `cardioKeyOf` / `CARDIO_KIND_COLOR` in `src/lib/workouts/endurance-charts.ts`; `eventSport` / `SPORTS` in `src/lib/sport/label.ts`, `sportsOfEvents` in `src/lib/sport/day.ts`; Sport selects in `src/app/admin/calendar/event-types.tsx` and `subscriptions.tsx`; `workoutBlocksFor` in `workout-log.ts` (home card) |
| Workouts as blocks (v0.744) | sport events per day in `sportsForDay` (`src/lib/sport/day.ts`); usual and per-day workout times in `src/lib/workouts/workout-time.ts`; the web list, sport page and time dialogs in `src/app/exercise/day-workouts.tsx`, wired in `day-log.tsx`; weekly kinds in `loadWeeklyTraining`; sport as cardio in `heat-run.ts` / `endurance-charts.ts` |
| Admin tabs (v0.797) | `src/components/admin-tabs.tsx` — `?tab=` on Workouts, Chores, Family map, Bible reading |
| Admin ↔ page mapping (v0.796) | `src/lib/admin-sections.ts` — used by `components/admin-lock.tsx`, `app/admin/close-admin-button.tsx`, `app/admin/lock-button.tsx`; `AdminBack({ parent })` for pages inside a section |
| Places visits and search (v0.795) | `src/lib/places/visits.ts` (snapshot, match, search, list, changes), `visits-types.ts`; timer in `src/lib/timers.ts`; `/api/v1/places/view/visits`, `/places`; page `src/app/places/search-view.tsx` via `renderSearch` |
| Map edge to the app (v0.793) | `useMapEdge` in `src/app/places/embed-context.tsx` → app `KairosPlaces.mapBottom` in `PlacesScreen.kt` |
| Generated tasks once per day (v0.792) | migration `181_generated_once` (partial unique index `Task_generated_once`); `createMany({ skipDuplicates })` in `src/lib/bible/generate.ts` and `src/lib/workouts/generate.ts` |
| Plates on bar lifts; Log with missed sets (v0.791) | `barOf` in `src/lib/queries/workout-log.ts` (`bar` on the sets payload); `plates` and the "Log with missed sets?" modal in `src/app/exercise/day-log.tsx`; app `SetCard` / `CoreWorkoutScreen` in `MovementSetsScreen.kt` |
| A movement on two cards the same day (v0.736): the first card keeps it | `repeatsByPlan` in `src/lib/workouts/day-repeats.ts` (pure), applied in `loadTodayPlannedWorkouts` (`repeatOf`, counted skipped) and on the web day page |
| Work-shift calendar feeds (v0.734) | `ExternalCalendar.isWork` (migration 160); `kind` chosen in `src/lib/calendar/sync.ts`; `setCalendarWork` re-kinds a feed's events (`src/lib/actions/calendars.ts`); the WORK colour in `src/lib/calendar/colors.ts` |
| A lift's chart numbers and trend (est. max, volume, reps, density; holding / last done; consistency) | `dayNumbers` / `liftTrend` / `weeksInARow` / `weekDots` / `isFixedWeight` in `src/lib/workouts/lift-stats.ts` (pure); UI `LiftPage` in `src/app/exercise/lift-page.tsx` |
| The monthly core test from what was logged | `testedThisMonth` in `src/lib/workouts/test-history.ts`, read by `syncCoreDays` |
| A companion slot's choices (pattern, never a main lift, library additions) | `loadProgramChoices` in `src/lib/workouts/program-run.ts`; role `patterns` / `groups` in `programs.ts`; additions joined by `applyLibrary` in `startProgram` |
| Warm-up countdown (a timed step and the timed steps after it, both sides in the chosen order, a pause between) | `warmupIntervals` / `warmupSchedule` / `warmupAt` in `src/lib/workouts/warmup-library.ts` (pure); UI `WarmupTimer` in `src/app/exercise/warmup-timer.tsx` (timer colours from `usePalette`, number font and colour from `useDigits`, in `conditioning-timer.tsx`) |
| Day page headline and sections | `dayHeadline` (kinds of work) / `withSection` (an empty Conditioning or Cardio section in the person's order) in `src/lib/workouts/blocks.ts`; the program's name on a program day |
| A companion lift's suggested weight (for its reps, from the last session's best set) | `weightForReps` / `targetsFor` in `src/lib/workouts/programs.ts` |
| The next cycle with changes (setup opened on the running plan) | `currentSetup` / `startProgram({ next: true })` in `src/lib/workouts/program-run.ts`; UI `CycleEnd` → `ProgramSetup` (`initial`, `nextMaxes`) in `src/app/exercise/program-card.tsx` |
| Core days: library workouts, own workouts, rotation and monthly plank test | `CORE_LIBRARY` / `stepCoreDay` / `coreDayMoves` in `src/lib/workouts/core-library.ts` (pure); `syncCoreDays` / `setCoreDay` / `saveCoreWorkout` in `core-run.ts`; UI in `src/app/exercise/core-days.tsx`; `hold:` scheme in `programs.ts` |
| Progress focus (today, else next planned day) and the home card's workout lines | `focusGroups` in `src/lib/workouts/focus.ts`; `cardLines` in `src/lib/workouts/day-title.ts` (both pure) |
| Body-map heat view (hard sets a week, heavy sets and bests over 12 weeks, the one range built since v0.696); core's plank-test benchmark | `buildHeat` / `scoreSets` / `unweightedDays` / `pftPlankPoints` / `plankTests` in `src/lib/workouts/heat.ts` (pure); `loadHeat` in `heat-run.ts`; UI in `src/app/exercise/heat-view.tsx` |
| Recent workouts by day; a past day's program | `groupHistory` / `dayLabel` / `programOn` in `src/lib/workouts/history.ts` (pure); `loadProgramSpans` / `sportLabels` in `history-run.ts`; `loadProgramOn` in `program-run.ts` |
| Home workout card's second line | `loadWorkoutDayExtras` in `src/lib/queries/workouts.ts` + the day's sport events, as the workout task's `subtitle` in `src/lib/queries/dashboard-api.ts` |
| Workout-page button styles | `PRIMARY_BTN` / `SECONDARY_BTN` (`_SM`, `_LG`) / `DANGER_BTN` in `src/app/exercise/buttons.ts`; phone `ui/common/AccentOutlinedButton` |
| A movement's kind from its name | `guessPattern` in `src/lib/workouts/library.ts`, used by `loadProgramChoices` for untagged pool movements |
| Warm-ups (look through, edit, create) | `WarmupLibrary` in `src/app/exercise/warmup-window.tsx`, the Workouts page's Warm-ups step |
| Saved plans (My plans) | `savePlan` / `savedPlansFor` / `renameSavedPlan` / `deleteSavedPlan` in `src/lib/workouts/plan-share-run.ts` (SharedPlan, status PRIVATE); UI `PlanLibrary` in `src/app/exercise/my-plans.tsx` |
| Your version of a program (kept on end/switch, Default or Your version when picking) | `snapshotVersion` / `versionsFor` / `forgetVersion` in `src/lib/workouts/program-run.ts`; `setupDiffers` / `cleanVersion` in `program-version.ts` (pure); UI in `program-card.tsx` (`ProgramList` tag, the ask window, `ProgramSetup` `fromVersion`) |
| Weekly training (kinds per week, planned days, a week's days, the Planned line) | `loadWeeklyTraining`, `plannedPartsFor` / `snapshotPlannedParts` / `plannedLine` in `src/lib/queries/workout-log.ts` (snapshots written by `generateWorkoutTasks` too); `src/app/exercise/weekly-training.tsx`; app `WeeklyTrainingCard` |
| Past rotation days as logged | `asLoggedRotation` in `src/lib/queries/workout-log.ts`; `DayLogState.asLogged`; web override in `day-log.tsx` (`basePlan`) |
| Core moves by time or reps | `src/lib/workouts/core-moves.ts`; `heat.coreMoves` (heat-run.ts) |
| Core progress, groups and the Core page | `buildCoreSummary` in `src/lib/workouts/core-progress.ts` (pure); `heat.coreSummary`; `CoreCard` / `CoreOverview` / `CorePage` in `lift-page.tsx`; app `CoreCard` / `CoreOverviewDialog` / `CorePageDialog` |
| Cardio and conditioning charts | `buildCardioCharts` / `buildConditioningCharts` in `src/lib/workouts/endurance-charts.ts` (pure); `heat.cardioCharts` / `heat.conditioningCharts` (heat-run.ts); `src/app/exercise/endurance-charts.tsx`; app `EnduranceCharts.kt` |
| Smarter day suggestions (hockey, balance, plan too big) | `daySuggestion` / `pushPullBalance` / `planFit` in `suggest.ts` (pure); `sportAround` / `planFitFor` / `balanceFor` / `dayAddedIds` in `suggest-run.ts`; `sportKindOf` / `tournamentDays` in `src/lib/sport/label.ts`; `sportDaysBetween` in `src/lib/sport/day.ts`; added movements in `withAdded` (workout-log.ts) |
| Family WOD | `src/lib/workouts/family-wod.ts` (pure) / `family-wod-run.ts`; `FamilyWod`, `FamilyWodMember`, `FamilyWodSuggestion`; `actions/family-wod.ts`; route `workouts/family-wod`; day payloads' `familyWod`; web `family-wod.tsx`, app `FamilyWod.kt` |
| Workout pauses (household, personal, and one person set by an admin) | `src/lib/workouts/pause.ts` (pure; reasons, `PAUSE_MAX_DAYS` 180) / `pause-run.ts`; `WorkoutPause` model; an admin's one-person pause is `Pause.userId` (migration 152; null = household), honoured by workouts/generate and `clearPausedTasks`; generate.ts, heat-run.ts, the strip, Weekly training, suggest-run.ts; `WorkoutPauseCard` / `WorkoutPausePage` (web `workout-pause.tsx`), `WorkoutPauseCard` / `WorkoutPauseScreen` (app `WorkoutPause.kt`) |
| Swapped days (one week) | `src/lib/workouts/day-swap.ts` (pure `planWeekday`) / `day-swap-run.ts` (`planDow`, `swapDays`); `dayPlanWhereFor` in workout-log.ts; generate.ts reads every person's swaps |
| Sore spots and hurt-day stand-ins | `src/lib/workouts/sore.ts` (pure, `SORE_PATHS`) / `sore-run.ts`; `pickStandIns` in `adjust.ts`; `standInsFor` in `adjust-run.ts`; `SoreSpots` in `src/app/exercise/sore-spots.tsx`; app `SoreSpots.kt`, `BodyMap(soreFront, soreBack)` |
| The training heat map: a group's colour earned by progress and eased back (v0.689), the endurance heart on weighted minutes (v0.690), "+N% since you started" | `buildTrainingHeat` / `weekPaused` in `src/lib/workouts/training-heat.ts` (pure; the rules are in its header comment); sets loaded and program starts, pauses and sore holds passed in by `heat-run.ts`. Carries resolve to a region in `navRegionFor` (`involvement.ts`): farmer → ARMS, suitcase / one-arm → CORE, overhead → SHOULDERS |
| A companion lift's next weight (steps only after Easy, only for sets that hit their reps; step size from the movement, not the plan slot) | `targetsFor` (`lastEasy`) / `stepFor` in `src/lib/workouts/programs.ts`; dumbbell and kettlebell sizes from Admin's equipment list via `bellOf` / `nextBell` / `bellAtOrUnder` in `src/lib/workouts/bells.ts` (pure) and `bellSizesFor` in `library-run.ts`. Program main lifts and 5/3/1 waves are unchanged |
| The web sign-in gate: session check, first run, PIN-bound unlock (v0.699) | `src/lib/web-gate.ts` (`webSessionUser`, `webBootstrapOpen`, `signAdminUnlock` / `adminUnlockValid`); `src/proxy.ts` (Next 16 proxy, formerly `middleware.ts`; frame headers via `FRAME_ANCESTORS`); baseline headers in `next.config.ts`; the per-request Content-Security-Policy with a script nonce (v0.706) in `src/lib/csp.ts`; `safeNext` (`src/lib/safe-next.ts`) for the sign-in redirect |
| Admin auto-lock after idle time (v0.696) | `adminIdleMinutes` / `ADMIN_IDLE_CHOICES` / `touchAdminSession` / `startAdminSession` in `src/lib/session.ts`; `touchAdminAction` / `setAdminIdleAction` in `src/lib/actions/admin-lock.ts`; `AdminIdleLock` in `src/app/admin/admin-idle-lock.tsx` (rendered by the admin layout); the setting on Admin → Settings → Device (`device-controls.tsx`). Cookie format unchanged for proxy.ts |
| Full-body moves: a muscle for lifts, heart minutes for conditioning moves (v0.696) | the whole-body rules, `endurance` and `heartMinutes` in `src/lib/workouts/involvement.ts`; the extra heart entries in `loadHeat` (`heat-run.ts`) |
| Re-baselining behind classes: restart undone plan work from the next school day, oldest first, unless it would finish past the class's deadline; fit-to-term plans re-fit (v0.701) | the rules in `rebaselinePlan` (`src/lib/school/rebaseline.ts`, pure); `loadRebaselinePreview` / `applyRebaseline` in `src/lib/school/rebaseline-core.ts`; `rebaselineSchool` in `src/lib/actions/class-plans.ts`; `CatchUp` (`src/app/admin/school/catch-up.tsx`) on Curriculum & schedule |
| Paused classes: one open item, rolled forward instead of late; the next appears when it's done; Resume re-lays the rest (v0.702, migration 154) | `ClassPlan.paused`; `ensurePausedNext` / `afterPlanUnitChange` / `rollPausedPlans` (once a day, from the school loaders) in `src/lib/school/plan-pause.ts`; the hook in `syncPlanUnitDone` (`plan-unit-sync.ts`); `resumePlanSchedule` in `rebaseline-core.ts`; `setClassPlanPaused` in `src/lib/actions/class-plans.ts`; Pause / Resume in `curriculum-plans.tsx` |
| A monthly test's "last time" is the last test, recognised as a day with one set of every hold in the test (v0.707) | `lastTestsFor` / `testGroupOf` in `src/lib/workouts/test-history.ts`; `lastTest` in `DayMovementState` and the `test` flag of `loadMovementLog` (`src/lib/queries/workout-log.ts`); `?test=1` on `/api/v1/workouts/sets` |
| Household appearance: color theme, mode (system / light / dark) and background, independent of each other (v0.710) | `THEME_*`, `BACKGROUND_*`, `APPEARANCE_MODES` in `src/lib/themes.ts`; `getAppearance` in `src/lib/settings.ts`; `html[data-theme]` / `html[data-bg]` and `.dark` in `src/app/globals.css`; the System script in `src/app/layout.tsx`; the picker in `src/app/admin/appearance/appearance-admin.tsx` |
| An event that ends before it starts (web form; the app's `timeInvalid`) | `timeInvalid` in `src/app/calendar/add-event-form.tsx`; `TimeSelect`'s `invalid` (`src/components/time-select.tsx`) |
| The chart hover pop-up (lift charts, Compare, plank test, cardio and conditioning charts) | `useChartTip` / `ChartTip` in `src/components/chart-tip.tsx` |
| Full page vs small pop-up on the web | `Modal` in `src/app/exercise/plan-file-panel.tsx` is a full page; `Modal small` is a centred pop-up for short choices, confirmations, ⓘ, date pickers and breakdowns. The app's twin is `ui/common/FullPage.kt`. No pull-up sheets on either |
| Workout-page section cards and chips (plan page, HIIT builder) | `SECTION_CARD` / `SECTION_LABEL` / `CHIP` in `src/app/exercise/buttons.ts` |
| A page left open past midnight | `DayRollover` in `src/components/day-rollover.tsx` (root layout); the app bumps `dataRevision` when `LocalDate.now()` changes |
| This week in the map pop-ups | `muscleWeek` / `enduranceWeek` in `training-heat.ts` (`TrainGroup.week`); `TrainDetail` in `heat-view.tsx`; app `TrainDetailDialog` |
| Lift rows and a lift's page (sparkline, trend, est. max, light weeks, marks, next target) | `src/app/exercise/lift-page.tsx` (`LiftRows`, `LiftPage`); pure numbers `src/lib/workouts/lift-stats.ts`; next target `lift-next-run.ts`; marks `heat-run.ts`; chart overlays `components/line-chart.tsx` (`shade`, `marks`, `ring`, `ahead`); app `WorkoutChart.kt` (`LiftRow`, `LiftPageDialog`) |
| Repeating tasks: when they land and their label (Daily / Weekly / Monthly / Yearly / every N) | `src/lib/tasks/recur-rule.ts` (pure); generator `src/lib/tasks/recurring.ts`; forms `admin/tasks/recurring-tasks-admin.tsx` and the app's AssignTaskScreen |
| Day extras ("+ Additional": mobility, stretching or an isometric workout on one day) | `src/lib/workouts/day-extras.ts` (ids, kinds; pure); `dayExtrasFor` / `addDayExtra` / `extraPlanFor` / `extraPlanRows` / `extraSimplePlans` in `day-extras-run.ts`; UI `AddConditioning` (now "+ Additional") in `conditioning-picker.tsx`, `ExtraPicker` in `additional-picker.tsx`, `extraWorkout` in `day-log.tsx` |
| Program setup steps, extras, end of cycle | `ProgramSetup` / `CycleEnd` / `Chooser` in `src/app/exercise/program-card.tsx`; shared `StepHeader` / `ExtrasStep` / `StepBar` / `DayChips` in `setup-parts.tsx` (classic and Odd squad); `startProgram` / `currentExtras` / `nextBlock` (raises) in `program-run.ts` |
| Quiet drives (v0.790) | `legOf` / `planDay` in `places/day.ts` (QUIET_GAP_MS, QUIET_DRIVE_MPS) |
| Work and backpacking behind the day (v0.788) | `background` / `feedTitle` set in `queries/calendar.ts`; `backgroundBlock` in `components/week-grid.tsx`; the app's `DayColumn` in `CalendarTimeGrid.kt` |
| Trip tile and Finished (v0.787) | `finishTrip`, `tripEventOn` in `workouts/backpacking*.ts`; the app's `BackpackCard` (TrackScreen) and `CalendarOpen.NewTrip` / `ShowEventId` |
| Workouts tabs and button groups (v0.786) | `ActionGroup` / `TileHeader` in `exercise/action-button.tsx`, tabs in `workouts-grid.tsx`; the app's `ActionGroup`, `TileButtons` in `WorkoutsScreen` |
| Replaced occurrences of a repeating event (v0.785) | `replacedOccurrences` in `calendar/overrides.ts`, used by `pendingSportPrompts`, `sport/day.ts`, `pendingClassPrompts`, `backpacking-trips.ts` and the upcoming-reminders route |
| 5/3/1's 7th week (v0.783) | `withSeventh` / `TM_TEST` in `workouts/programs.ts`; `PersonProgram.seventhWeek`; `toActive`, `nextSeventh`, `setSeventhWeek` in `program-run.ts`; ask card in `day-log.tsx` and the app's `WorkoutLogScreen` |
| Endurance days and finishers (v0.754) | `enduranceOf` / `enduranceName` in `workouts/other-days.ts`; `ENDURANCE_LIBRARY` / `CARRY_LIBRARY` in `core-library.ts`; finishers in `startProgram` / `currentSetup` (`program-run.ts`); `markCircuit` in `mark.ts`, `circuitEntries` in `heat-run.ts`; `FinishersStep` / `OtherDayWindow` in `setup-parts.tsx`; app `ProgramsScreen` |
| Rest days on the charts (v0.753) | `restedDays` in `workouts/heat-run.ts` (`heat.restDays`); `rest` status in `loadWeeklyTraining` (`queries/workout-log.ts`); `RestSquare` in `exercise/rest-square.tsx`; app `RestSquare.kt` |
| Other days windows (v0.753) | `splitOther` / `joinOther` in `workouts/other-days.ts`; `makeOtherDay` in `program-run.ts`; `OtherDayWindow` in `setup-parts.tsx`; app `OtherDayWindow` in `ProgramsScreen` |
| Plateau card (v0.752) | rules in `workouts/plateau.ts`; `plateauFor` / `answerPlateau` in `workouts/plateau-run.ts`; `PlateauCard` in `program-card.tsx`; app `PlateauCard` in `WorkoutsScreen`, `Route.ProgramsStart(key)` |
| Two programs on one day (v0.750) | `dayProgramBlocks` and `workoutBlocksFor` in `queries/workout-log.ts`; `setProgramDaySkipped` in `workouts/mark.ts`; `prog:<id>` blocks in `day-log.tsx` / `day-workouts.tsx`; app `programInView` in `WorkoutLogScreen`, `DayBlockUi.program` |
| Two programs at once (v0.749) | `PlannedWorkout.programId`; `loadActivePrograms` / `alsoPrograms` / `programInfosFor` and the `add` / `programId` paths of `startProgram`, `endProgram`, `nextBlock` in `program-run.ts`; plan card and `ProgramSection` in `program-card.tsx`; app `ProgramsScreen` (`startAdding`, `editProgramId`), `Route.ProgramsAdd`, `Route.ProgramsEdit(programId)` |
| Other days, What's next, success marks (v0.748) | `otherKindOf` / `cleanOtherKind` in `src/lib/workouts/other-days.ts`; `currentOtherDays` / `cleanOther` / `makeOtherDay` / `cycleCheck` in `program-run.ts`; `waveCheck` / `ladderCheck` / `HARDER` / `feltEasy` in `programs.ts`; UI `OtherDaysStep` / `ReviewWeek` in `setup-parts.tsx`, `WhatsNext` in `program-card.tsx`; app `OtherDaysStep` / `WhatsNextDialog` in ProgramsScreen.kt |
| The plan card, Your plan, Saved plans (v0.747) | `planSummary` / `buildStrip` in `src/lib/workouts/plan-summary.ts` (in `loadProgramsFor` and `GET workouts/programs`); `ProgramCard` (plan card, `WeekStrip`) and `ProgramSection` (plan page) in `program-card.tsx`; `saved-plans.tsx`; app `PlanCard` (WorkoutsScreen), `ProgramSection` (EditPlanScreen), `SavedPlansScreen`, `Route.ProgramsEdit` |
| A program slot's movement choices and top-weight prefill | `loadProgramChoices` in `src/lib/workouts/program-run.ts` |
| The 5/3/1 logger (% per set, plates button, no ±5) and the Timer tile | `DayLog` / movement logger in `src/app/exercise/day-log.tsx`; `pct` on target sets from `targetsFor` |
| + Conditioning on any day | `AddConditioning` in `src/app/exercise/conditioning-picker.tsx`; `conditioningDone` from `conditioningOnDay` |
| How a movement felt and where it hurt | `setMovementFeedback` in `src/lib/workouts/feedback.ts`; effort and area keys in `catalog.ts` |
| How a pool movement is logged, and which names are holds | `poolMetricFor` / `isHoldName` in `src/lib/workouts/catalog.ts`; new plan entries via `poolMetrics` (`src/lib/workouts/plan-edit.ts`); changes spread by `setPoolExerciseMetric` |
| Saving one movement's sets for a day (add, edit, remove, swap, late) | `logMovementSets` in `src/lib/workouts/mark.ts`; phone via `/api/v1/workouts/sets` |
| Whether the day's workout task is complete | `workoutTaskTarget` (applied by `settleWorkoutTask`) in `src/lib/workouts/mark.ts` |
| What the Hockey page shows and what each Add fills in (web + phone) | `buildHockeyView` in `src/lib/hockey-view.ts`, served to the phone by `/api/v1/hockey` |
| Changing your own password (web profile + phone) | `changeOwnPassword` in `src/lib/accounts.ts`; phone via `/api/v1/auth/password` |
| Which sections the menu hides (web sidebar + phone drawer) | `hiddenNavFor` in `src/lib/personal-scope.ts`, served to the phone by `/api/v1/nav` |
| A person's Hockey section order and which are open | `arrangeSections` in `src/lib/hockey-view.ts`; saved by `saveHockeyPrefs` in `src/lib/hockey.ts` |

When a rule must also run on the phone — the notes rule (`NoteField.kt`) and the
calendar-file import (`IcsImport.kt`, which reads the file on the device) — the
Kotlin copy says so at the top, and the two are tested for parity across the
whole input space, not a couple of examples: `scripts/ics-parity/check.sh` runs
hand-written and seeded random files through both and diffs the drafts.

## Game-time monitoring spans three repos

Game time is **monitoring only** (the allowance/token model was retired) and is
fed by a subsystem that lives across three repositories:

- **Web (`kairos`, this repo)** — display + source of truth. Owns durable history
  (`GameDay` / `GameDayTitle` / `PlayerCard`), the `/games` page, and the
  `/api/v1/game-time` read API for the app. It holds **no** game-service
  credentials and does no merge logic — it just upserts what it's given at
  `POST /api/v1/game-time/ingest` (auth `X-Ingest-Token`; contract in docs/API.md).
- **Collector (`kairos-game-collector`)** — the only thing that talks to Xbox (via
  Home Assistant), Steam, and Family Safety PC app usage (the `ally` source,
  allowlisted by `GAME_APPS`). It resolves each kid's actual game-session time
  (online presence is *not* counted), applies the Steam-primary merge, and pushes
  resolved daily rollups to the ingest endpoint. Its own repo holds the detection
  model and decisions.
- **App (`kairos-app`)** — a read client of the web `/api/v1/game-time` surface;
  it has no game-source knowledge.

So credited minutes are computed once, in the collector, and flow one way:
collector → web (store) → app/web (display).

## Places: Home Assistant pushes, Kairos keeps

Family locations come from the Home Assistant Companion app already on each
phone. A Home Assistant automation posts every position change to
`POST /api/v1/places/ingest` with a token made under Admin → Places (stored only
as a hash). Kairos holds no Home Assistant credentials. It keeps raw points
(`LocationPoint`, one row per person + reported time) and the person ↔ entity
links (`PlacesPerson`); stops, drives and place names are to be worked out when
a day is read (planned), never stored. Setup: `docs/places-home-assistant.md`.

The Places page (v0.757) draws one Google map per visit and only moves markers
on its 30-second refreshes. Place names resolve server-side
(`src/lib/places/resolve.ts`): saved address → cached Google answer
(`PlaceLookup`, 30 days) → Nearby Search → reverse geocoding, with Kairos's own
daily limits and counts (`PlacesApiUsage`). Only `/places` pages get the wider
Content-Security-Policy Google Maps needs (`isMapPath` in `src/lib/csp.ts`), so
the sidebar opens Places with a full page load.

v0.758 adds a person's day (`/places/<person>?date=`): `planDay`
(`src/lib/places/day.ts`, pure) splits points into stops and trips; finished
drives are snapped once with the Roads API (`src/lib/places/roads.ts`,
`SnappedPath`, 30 days); the same plan draws today's per-person tracks on the
live map. Family-named spots (`PlaceName`) come first in place naming.
v0.761 routes sparse drives with the Routes API instead
(`src/lib/places/route-check.ts` decides and validates, pure), and
`src/lib/places/zones.ts` learns each HA zone's centre for the live map and
History stops.
v0.762 serves the same pages to the phone app under `/places/embed` (shared
`src/app/places/render.tsx`; `embed-context.tsx` switches data to
`/api/v1/places/view/*`). `src/lib/places/embed-session.ts` holds the
ticket → `fd_places` cookie hand-off; proxy.ts admits that cookie only for
GET on embed paths, and the root layout renders them without chrome.

v0.759 adds notifications: `checkPlaces` (`src/lib/places/notify.ts`) runs
after each ingest on the person's newest point, against only the places a
`PlacesNotifyRule` mentions (`fenceStep`: arrive inside the radius, leave 50 m
beyond, state in `PlacesAlertState`). Messages go through `src/lib/push.ts`:
stored in `PushMessage`, then a content-free FCM HTTP v1 ping (service-account
JWT, no SDK) to the person's registered devices; the app fetches the text from
`/api/v1/push/inbox`. Firebase app values are served to the app at runtime
(`/api/v1/push/config`), so the APK carries no project config.

v0.760: points carry the Home Assistant zone (`LocationPoint.zone`). A zone
names the place right after the family's own names, keeps a person "there"
through GPS wobble, names History stops by majority, and can be a notification
place (`PlacesNotifyRule.zone`, following HA's zone changes). Kairos's own
places keep working without it.

## Hockey reads a separate container

Ice times come from **ice-time** (its own repo), which reads a rink's public
registration pages and serves a JSON feed. Kairos keeps only its address and
token (Admin → Hockey), fetches the week on each page open in
`src/lib/hockey.ts`, and stores nothing. Everything rink-specific lives in
ice-time's own data volume.

## Layout

```
src/app/            routes; /admin/* is PIN-guarded by its layout
src/components/     shared UI
src/app/api/v1/     the device API the Android app talks to (docs/API.md)
src/lib/
  actions/          "use server" mutations
  queries/          read paths for pages (incl. movement-stats.ts)
  api/              device auth and error shapes for /api/v1
  chores/ bible/ calendar/ school/ workouts/ groceries/ scoring/ tasks/
                    domain logic
  companions*.ts    roster, hatching, growth tenure
  dates.ts          every date conversion
prisma/migrations/  hand-written SQL, applied on container start
scripts/            preflight.sh and its checks; ics-parity/
```

Each feature area has a read-only page anyone can see and an editor behind the
PIN — `/chores` and `/admin/chores`, `/bible` and `/admin/bible`.

## Conventions

- Migrations are hand-written SQL and numbered; `/about` compares the ones
  applied in the database against the ones this build expects, which catches a
  partial deploy in seconds.
- `src/lib/version.ts` carries the version and a short changelog.
- Repository docs are the source of truth, not any tool's memory: ARCHITECTURE.md
  (how it's built), ROADMAP.md (the open list, then what's built), DECISIONS.md (what was
  decided and why), docs/API.md (the mobile contract). A change that makes,
  reverses, or narrows a standing decision — a security posture, an auth
  boundary, a scoring rule, the mobile contract — updates DECISIONS.md in the
  same release, the same way version.ts and ROADMAP.md are always touched.
- A bordered button, chip or field always sets `bg-surface` (v0.742), so it
  stays white on the grey page. A sticky footer on a full page uses the page
  background (`bg-ground`), not a white bar.
- ROADMAP.md's **Open** list is the only list of agreed, unbuilt work. A release
  that ships an item removes it from Open and describes it under Built; a
  dropped item moves to "Not doing". No other section carries open items.
- `scripts/preflight.sh` is the gate before shipping. It generates the real
  Prisma client, against a stand-in schema engine where the engine download is
  blocked, and runs a full type check with it. Only if generation fails does
  it fall back to `typecheck-report.mjs --changed`, which is strict at the
  lines you edited. It then runs `check-jsx-escapes.py` and
  `check-prisma-select.py`. It removes the client it made, since
  `src/generated` isn't git-ignored. It is deliberately not part of `npm run build` —
  the builder image may lack Python, and a check that breaks the deploy it
  protects is worse than none.
- Without a generated Prisma client every query result types as `any` locally,
  so a field read that was never selected passes `tsc` and fails in Docker.
  preflight now generates one, but still hand-audit every new Prisma `select`
  against `schema.prisma`; `check-prisma-select.py` catches the common shape
  of the mistake.
- Migrations are idempotent (`IF NOT EXISTS`, guarded `CREATE TYPE`) and are
  registered at the END of `MIGRATIONS` in `src/lib/version.ts` — the array is
  order-sensitive. Derive at read time; never store computed values.
- Numbers, times, and dates use the `.tabular` class so columns stay aligned
  as values change.
