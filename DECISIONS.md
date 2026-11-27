# Decisions

## 2026-11 — Home: stale refreshes no longer undo a tap (0.586.2)

- Seen: tap Bible reading, the check shows then vanishes, the next tap does
  nothing, and after a restart it's done. A refresh that began before the tap
  (on resume, or `tasksChanged`) came back after it with the old state and
  replaced the optimistic one; the second tap was ignored because the first
  was still saving. `HomeViewModel` now keeps the time of the last tap start
  or finish (`touched()`, on every `busyIds` change) and `freshIfCurrent()`
  drops a fetch that began before it, or while another tap is saving. Only
  one load runs at a time; a refresh asked for meanwhile rides on it.
- The thin bar along the top is any GET in flight (`RefreshTracker`), not a
  sync; it stays as long as a request is slow.

## 2026-11 — Pick lists open over the page (0.586.1)

- `RollPicker` (Assign a task's For and Ends, Add school work's For and Type,
  Create a workout's Type and Add an exercise, the block builder's Garage
  length) and Create a workout's saved-workouts list are `DropdownMenu`s as
  wide as their field, over the page, instead of expanding in place. Sections
  that open in place on purpose (Completed tasks, hockey sections, the
  calendar's month) stay as they are.

## 2026-11 — The Cardio page's activity picker (0.586.0, web 0.814.0)

- `ActivityPicker` in `EnduranceCharts.kt`: icon-over-name segments ordered by
  last done (`orderActivities`, the web's); up to five recent ones as
  buttons, else four and More. More is a `DropdownMenu` (over the page) with
  Last 12 weeks and Older. New icons: Rower, Bike, JumpRope, Heart; hiking
  uses Mountain.

## 2026-11 — Weekly bars you can read (0.585.4)

- `WeekBars` takes a `tip`: each bar gets its value on top (2.5k, 800, 12.4)
  and a tap picks a week, dims the others and spells it out underneath
  ("Week of Nov 16 · 2,500 m"; this week to start). Used for the Cardio
  page's distance or minutes per week and Conditioning's sessions per week;
  the web's charts already show the same on tap or hover.

## 2026-11 — Family goal pill says Vote (0.585.3)

- The home Family goal pill said Pick when the server's `homeNudge` was
  "pick"; the web has said Vote either way since 0.804. Now the app does too.

## 2026-11 — Family WOD always a button; no Something else (0.585.2, web 0.813.1)

- `DayTiles` always shows Family WOD (`hasFamilyWod` adds Today) and opens
  the Family WOD screen. `LogAnotherPage` has four choices; Something else
  only repeated them.

## 2026-11 — Timer settings build fix (0.585.1)

- `TimerSettings` had `var sound … private set` beside `fun setSound()`: the
  JVM names clash. The setters are `saveSound()` and so on. A Compose state
  property with a private setter can't also have a hand-written `setX`.

## 2026-11 — One timer, the workout day's buttons, tracked workouts (0.585.0, web 0.813.0)

- `TimerKit.kt`: every timer (Conditioning, warm-ups, each-side, the free
  Timer, the Family WOD) draws `TimerFace` and plays `TimerCues`, with one
  `TimerSettings` in the `kairos_timer` prefs (`t_*` keys, read from the old
  per-timer keys once). Looks: Ring and Full color, chosen separately for
  your workouts and the Family WOD (a card whose plannedWorkoutId starts
  "fwod_"). The floating window and notification work for every timer,
  the each-side one included.
- Fixed with it: one Sound and one Get ready (Conditioning 10 s, warm-ups 5 s,
  each-side none before); 3-2-1 into each side; vibration only at changes;
  one end tone; one Start side and Pause between sides (warm-ups use it when
  a step switches sides); into work high, into rest low on every timer.
- The day's buttons are `DayTiles` (the Workouts page's `ActionCard` /
  `ActionGroup`, now internal). `AdditionalMenu` and `ExtraPickerPage` are
  gone: Log another is `LogAnotherPage`, routines are `RoutinesPage`.
- Tracked walks, runs, rucks and hikes come from the day's `tracked` (server
  0.813) as done cards in `CARDIO_COLOR`; nothing to open.

## 2026-11 — Menu swipe off the map (0.584.0, web 0.812.2)

- The Family map page now reports the band its map takes (`KairosPlaces.mapBand(top, bottom)`,
  0,0 for none) instead of only where the map ends. A rightward swipe anywhere off the band opens
  the menu, so History, All places and the place lists swipe everywhere; the place sheet's map and
  the add-stop pin picker keep their swipes for panning. Older pages still call `mapBottom`.

## 2026-11 — Watch how on warm-up steps (0.583.0)

- A warm-up step's ⓘ shows on every step and opens `MovementInfoDialog`
  (its cue and Watch how).

## 2026-11 — The list stays; didn't-go greyed (0.582.0)

- With a `workoutCard`, the tile shows its list before "Complete for today!",
  so a finished day still reads each workout (done in green). A skipped
  practice or game (`skipped`) is greyed; "N of M workouts" only shows with two
  or more counted.

## 2026-11 — In progress; green when done (0.581.0)

- The Workouts tile no longer lists the remaining parts of a started
  workout: the name and "In progress" (italic, where its details go). With
  several workouts the finished one's name and bullet are green.

## 2026-11 — Didn't go isn't a workout (0.580.0)

- The day page's heading counts blocks except a sport answered "didn't go";
  that event stays listed so the answer can be changed. The tile and the
  greeting chip come from the server (0.808).

## 2026-11 — Smaller workout details (0.579.0)

- The detail under a workout's name on the tile is 10sp.

## 2026-11 — Details under the workout (0.578.0)

- `WorkoutCardItemDto.detail` shows under its workout's name, lined up with
  the name; the 3dp bullet is faint, green once done. With an older server
  (no detail) the kinds line stays at the end.

## 2026-11 — Workout bullets (0.577.0)

- The tile's workout lines use a 5dp bullet (green when done) instead of a
  ring and check. The Chores page's get-ahead explanation is removed.

## 2026-11 — Late work gets its own page (0.576.0)

- School and Chores no longer list overdue work inline: `LateCard` (red
  outline, count, oldest date, up to three classes or chores) opens
  `LateWorkPage`, shown in place of the area page with Back returning to it.
  School filters by class (the subtitle's first part); checked rows stay put
  until the next refresh. No card once nothing is still late.

## 2026-11 — Log another workout up front; how it felt (0.575.0)

- The day's Add button (now "Log another workout") and what was logged
  besides the plan moved to Today's workouts, under the list. The day page
  keeps them only when there's no list (nothing planned).
- The log flow ends on "How did it go?": `EffortChooser`, saved with the
  existing feedback endpoint. Slot: the pool movement's id, `hiit:<id>`, or
  `custom:<category>`. Done or Back leaves.
- Log it's value step is on a surface card; the picked metric chip is filled.

## 2026-11 — Workouts tile lists each workout (0.574.0)

- With server 0.798's `workoutCard`, two or more workouts read one per line
  at the title size, each with a ring that turns into a green check when done,
  then the plan's kinds ("Core · Cardio · Isometric") on one line. No event
  times (they're in Today's schedule). Over three: the first two and
  "+N more", so the tile doesn't grow. Older servers fall back to the old lines.

## 2026-11 — Release publishing survives GitHub errors (v0.573.0, server 0.795.0)

- 0.572.0's Release run failed twice with HTTP 500 from GitHub on creating the
  release. The publish step now retries (4 tries, 15/30/45 s apart), treats a
  half-made release as existing (uploads with `--clobber`), and finishes with
  `gh release edit --draft=false`, so a leftover draft gets published — the
  in-app updater reads only published releases.
- The Places page and the map-style button are the web pages' (server 0.795);
  the app shows them in the Family map as they come. No Kotlin changed.

## 2026-11 — Menu swipe below the Family map (v0.572.0, server 0.793.0)

- `PlacesScreen` adds a `KairosPlaces` JS interface (`MapEdge.mapBottom`, CSS px,
  volatile) that the embed pages call with the map's bottom edge. The WebView's
  touch listener still keeps every touch for the page, but a drag that starts
  below the map and goes right more than 56dp (and over twice its vertical
  drift) calls `onOpenDrawer`. Swipes on the map still pan it.
- The locked map / scrolling list and the history page's compact top are the
  web pages' own layout (server 0.793); the app shows them as they come.

## 2026-11 — Area colors made distinct (v0.571.0, server 0.792.0)

- `APP_SECTIONS`: Workouts `0xFF9F1239` (was the late red `0xFFDC2626`),
  Game time `0xFFA21CAF` (was nearly School's indigo), Ice time `0xFF1E3A8A`
  (was nearly Reading's cyan), Chores `0xFFEA580C` (was close to Summary's
  gold). The Chores detail screen takes `sectionFor("chores").color` instead
  of its own literal. Same values as the web sidebar.
- The doubled readings/workouts at midnight were server-side duplicate rows,
  fixed in server 0.792; nothing changed in the app for it.

## 2026-11 — Reading bars the same length (v0.570.0)

- The % after each home reading bar has a fixed 36dp width (right-aligned),
  so "0%" and "68%" no longer give the bars different lengths.

## 2026-11 — Plates on bar lifts; Log with missed sets (v0.569.0, server 0.791.0)

- `MovementLogDto.bar` ("barbell" / "ez" / null, server 0.791) goes into
  `MovementSetsUi.bar` (and follows a swap). A WEIGHT movement with a bar sets
  `SetCard(strict = …)`, which only decides plates vs remove; the VM's
  `strict()` (program-fixed weights) is unchanged. `bar == "ez"` also picks
  the EZ bar in the calculator alongside the name check.
- "Finish early?" became "Log with missed sets?" with Keep going / Log; Log
  is the old `leave(logTyped = true)` (finishing, `open = false`).
  `CoreWorkoutScreen` now asks the same before `finish(true)` when any
  non-skipped movement has sets not done.

## 2026-11 — Home page corrected to the chosen mockup (v0.568.0)

- 0.567 used layout 2 (greeting with a bar); the owner chose layout 1,
  "Greeting with the ring", in "Kairos: Home page, chosen pieces". Fixed per
  "Kairos: Home page, corrected" (reading B, family goal B).
- `GreetingCard` is a row: date, greeting and `AreaChip`s on the left,
  `DayRing` (a 56dp drawn ring, "done/total") on the right. No Material
  `LinearProgressIndicator` on the home page any more: its end-stop dot read
  as a progress marker at the wrong end, so bars are plain filled boxes.
- Tiles: `TILE_MIN` (124dp) minimum height on every tile so all rows match;
  title `bodyLarge` SemiBold in `onSurface`, text under it `bodyMedium` /
  `bodySmall` / `labelSmall`.
- Workouts: a single workout titled "Program · Lifts" shows the lifts as the
  line and the program plus the day's extras under it.
- Reading: per book, the title on its own line, then the bar with the % at its
  end (red when behind).
- Family goal: surface white, 1.5dp gold outline at 35%, an inner glow from
  three stacked edge strokes at 5% (clipped to the shape), trophy, "N ideas
  waiting" and a gold Pick/Vote pill that opens the goal page.

## 2026-11 — The home page as tiles (v0.567.0)

- Mockups "Kairos: Home page, chosen pieces" (layout 2) and "Kairos: Home
  tiles, states and counts". `GreetingCard` replaces the header and the bars:
  date, "Morning / Afternoon / Evening, name" (4–11, 12–4, 5 PM–3 AM), a bar
  with "N of M done" from the categories, and an `AreaChip` per area.
- Each area is a `HomeTile` in `TileGrid`: two across at equal width (a row
  is `IntrinsicSize.Min` high so both match), an odd last one full width.
  Chores, School, Workouts and Reading keep their own logic inside a tile;
  list areas (Bible, Tasks…) are a `TaskTile`: one item and the tile taps to
  toggle it, several and each line taps.
- States: DONE (green 10% wash, check), OVERDUE (red 6% wash, red count);
  reading behind is "N% behind" in red. Prompts sit under the greeting; the
  family goal (now with a gold wash) follows the tiles; the schedule keeps no
  colored edge.

## 2026-11 — Grey stripes' words; Summary gold (v0.566.0, server 0.789.0)

- A background block whose color is nearly grey (`isGreyish`: channels
  within 0.12) gets #2B2F36 words. Summary's color is #CA8A04; the family goal
  card's outline is it at 50%.

## 2026-11 — Work and backpacking behind the day (v0.565.0, server 0.788.0)

- `DayColumn` lays out `background` events on their own and draws them first:
  a 7% wash, diagonal stripes at 16% and a 3 dp edge, all in the event's color
  (the server's grey when others are grey). Others' events are placed over
  them as if they weren't there, set in 6 dp where they overlap one.
- Names (`whoLabel`) under the title on others' events, never on an event
  that's only yours.

## 2026-11 — Trip tile, Start a…, home edges (v0.564.0, server 0.787.0)

- `BackpackCard` on a trip day is the trip tile: `TileHeader` (now internal)
  on a 8% primary tint, `TileButtons`: Track/Pause (TripTrack start/end),
  Camp/Hike (`TripTrack.camp`/`hike` send the service's actions), Finished on
  the last day (`markFinished`, `{finish:true}`), Map (Family map), Trip
  (`CalendarOpen.ShowEventId`, which moves the calendar to the day if needed).
- Start a… → Backpacking trip: `CalendarOpen.NewTrip`, an all-day draft on the
  type with `backpacking`. `BackpackStart` ("Back on") removed.
- Home cards: `Modifier.sectionEdge(key)` draws a 4 dp edge in the section's
  side-menu color; Today's schedule has none.

## 2026-11 — Workouts tabs and groups (v0.563.0, server 0.786.0)

- Progress | Train tabs (`ChooserTabs`), Progress first; the tab is
  `rememberSaveable` and each tab has its own scroll state. The tour's stops
  switch to the tab they point at.
- The page's loaded data (progress, week, training, programs) lives in
  `WorkoutsHomeState`, a ViewModel on the nav entry. With plain `remember` the
  page came back empty, the restored scroll was clamped to 0 and it opened at
  the top. The spinner shows only before anything has loaded.
- The nine buttons are three `ActionGroup`s (tinted `TileHeader`, a row of
  `ActionCard`s with the accent outline). The plan card's actions are one row
  of `TileButton`s, the icon over the label; `KairosIcons.Stop` is End's.
- The week strip's labels match Workout days' (9 sp, two lines, centred).



## 2026-11 — Back to the workout; program tile (v0.562.0, server 0.784.0)

- The day's opened workout (`pick`) is saved state (`dayPick` delegate over
  two `rememberSaveable` values, kept per date). It was `remember`, lost when
  a movement's screen replaced the day page, so Log came back to the list.
- Program tile, option B: `TileHeader` (accent band: PROGRAM or PLAN, name,
  week) and `TileButtons` (outlined, two to a row) on WorkoutsScreen.

## 2026-11 — 5/3/1's 7th week; the lift page line (v0.561.0, server 0.783.0)

- `ProgramInfoDto.seventhAsk` → `WorkoutLogUiState.programAsk`: a card on the
  day page with Deload and TM test (`POST workouts/programs/seventh`).
- The lift page shows `targetTitle` (the program line), or the sets when
  there's none, without "Today".

## 2026-11 — Trip GPS (v0.559.0, server 0.779.0)

- `TripService` (location foreground service) runs through the trip's last
  day: GPS every 30 s hiking, 5 min stopped (still 20 min), 15 min at camp
  ("At camp for the night?" after 3 PM, once a day; actions go to the
  service). Moving 150 m+ from a stop or camp is hiking again.
- Points go to a line-per-point file (`trip-points.jsonl`) and are sent 400
  at a time every 5 min with `X-Kairos-No-Queue` (the trip keeps its own
  unsent points instead of the offline queue, which caps at 500 writes).
- Started by Start trip, or Yes / Turn on on the Workouts trip card (until
  the trip's last day from the server's day/of); restored on app start.
- The card shows the last finished trip's summary for two weeks.


## 2026-11 — Start pages; backpacking trips (v0.558.0, server 0.778.0)

- Every activity opens its Start page (no starting on the tap); the
  long-press shortcuts open the same page.
- Backpacking uses no phone GPS (owner's call): "Backpacking trip" in Go for
  a… posts `workouts/backpacking { start, until }` (the server makes the
  calendar event); `BackpackCard` on Workouts shows the day, miles and
  "Hiking today?" (`{ hiking }`). The server logs each day from Family map
  locations.


## 2026-11 — Go for a walk, run, ruck or hike (v0.557.0, server 0.777.0)

- Tracked with the phone's own GPS (`LocationManager` GPS provider, 2 s) in a
  `location` foreground service (`TrackService`), started only from the app,
  so no background location permission. No Play Services dependency.
- `ActivityTrack` holds the outing (start, pauses, points, distance) and
  writes it to `filesDir/track.json` (every 15 s and on each change); the app
  restores it on start and restarts the GPS if it was still going.
- Points: fixes over 30 m accuracy, steps under 5 m, and jumps faster than
  4.5 m/s (9 m/s running) are skipped; each resume starts a new segment and no
  distance is counted across a pause.
- Pause asks first; the notification has no Pause (it can't ask), only Finish,
  which opens the summary (Resume is still there).
- Saved with `POST workouts/track` (clientId makes a resend harmless; offline
  it queues like any write). Route thinned to 4,000 points.
- Entry points: a Workouts tile next to Log workout (Saved plans moved to the
  plan card to keep nine tiles), + Additional on today's log page, and dynamic
  long-press shortcuts (Walk, Run, Ruck) that route through `pendingRoute`
  ("track:walk" …; "track" / "track-finish" from the notification).


## 2026-11 — Your reminders on any event (v0.556.0, server 0.774.0)

- Event detail's "Your reminders" chips now show on every stored event (not
  only feed events): they start as the event's own; tapping saves the
  person's own list (all off = muted for them). "Use the event's reminders"
  resets when they had their own (`reset: true`).
- The event form edits the event's own reminders (`eventReminders`, falling
  back to `reminders` on older servers); "Remind me about this" is gone — the
  reminders go to everyone on the event and each person can mute theirs.
- Default reminders (`ReminderDefaults`) are saved in the person's choices on
  the server (`reminderDefaults`): a new phone takes them; a phone with its own
  and none saved sends them up; changing one pushes it.


## 2026-11 — More optional news (v0.555.0, server 0.773.0)

- Switches: "My turn on shared chores" (morning), "Family workouts I'm in",
  parents' "Money and suggestions to approve". All start off. They arrive on
  the "Kairos updates" channel; a tap opens Money / Workouts / Chores (the
  notification's link → section key via `pendingRoute`).


## 2026-11 — Instant sync, three calendar switches (v0.554.0, server 0.772.0)

- A Firebase `{k: "sync"}` data message (server: debounced 20 s after any
  write to Event, EventParticipant, Task, SubscribedReminder, RecurringTask;
  normal priority) runs `NotificationWorker` now and
  `SyncManager.remoteChanged()` (evict the HTTP cache, bump `revision`, so
  open screens reload). Reminders still fire from local exact alarms.
- Calendar choices are My events / Family events / Others' events I'm on (a
  reminder only ever comes when the event's reminders name the person).
- "When someone gives me a task" (`assigned`), off until turned on.
- Push channel stays one ("Family map" id `places`) for now; task alerts
  from the server use it too.


## 2026-11 — Notifications are each person's own (v0.553.0, server 0.771.0)

- Settings → Notifications is the one place: calendar "Reminders on my
  events" / "Reminders others set for me", task alerts, Family map "Tell me
  when …" (who, place, arrives/leaves), Safety for parents (per child speed;
  no update for N hours; battery below N%), quiet hours (presets). Saved on
  the server (`GET/POST notify/prefs`); the phone keeps only its two
  scheduler switches (`NotifPrefs.enabled` = either calendar choice,
  `tasksEnabled`) in step via `NotifySync`.
- First run after the update: if the server has nothing for the person, the
  phone sends its own current switches (both calendar choices = the old
  Calendar switch), so nobody gains or loses alerts. A new phone takes the
  saved choices.
- `NotifPrefs` lost its unused fields (scope, per-type, birthday).
- Server-side filtering: the upcoming feed drops reminders the person turned
  off, so the scheduler code is unchanged.


## 2026-11 — Places → Family map (v0.552.0, server 0.766.0)

- Labels only: menu, screen title, messages, and the notification channel's
  name (`createNotificationChannel` with the same id renames it and keeps the
  person's settings). Section key `places`, packages and the `places` channel
  id stay.


## 2026-11 — Places touches, redirects, diagnostics (v0.551.0, server 0.762.0+)

- The menu's swipe-to-open (Material ModalNavigationDrawer, anywhere on the
  screen) stole sideways drift from the Places WebView and cancelled the
  page's gesture, so panning the map and scrolling the list were choppy and
  opened the menu. The WebView now calls
  `parent.requestDisallowInterceptTouchEvent(true)` on ACTION_DOWN, which
  Compose's AndroidView interop honours: the page owns its touches, and the
  menu still opens from the logo or the top bar. Drawer gestures stay on
  elsewhere (Calendar remains the one screen with them off).
- An off-origin navigation without a tap (a redirect, e.g. Authelia's portal
  in front of the server) is no longer handed to the browser; the screen says
  Places was sent elsewhere. Tapped outside links still open in the phone's
  apps.
- Diagnostics get `places …` breadcrumbs: link ok/failed/off, pages loaded,
  main-frame HTTP errors, load errors, redirects away.


## 2026-11 — Places and Kairos notifications (v0.550.0, server 0.762.0)

- **Places is the web page in a WebView** (`ui/places/PlacesScreen.kt`), not a
  native map: same Google map, tracks, History and replay as the web, no Maps
  SDK. The device token never enters the page: the app asks
  `POST places/web` for a one-time link (60 s), the WebView opens it and gets
  a 12-hour cookie for the `/places/embed` pages only. A main-frame 401 gets a
  fresh link (at most 3 per visit). Links away from Places open in the
  phone's apps. "Not right?" stays on the web.
- **Notifications are an inbox with a ping** (`data/push/Push.kt`). The server
  keeps each notification; with Firebase it sends a content-free
  `{k: "inbox"}` data message and the app collects `GET push/inbox`.
  Firebase is started in code from `GET push/config` values remembered in
  SharedPreferences (Application.onCreate starts it from them, so a ping can
  start the app); `FirebaseInitProvider` is removed and there is no
  google-services plugin or json, so nothing about any server's Firebase is
  in the APK. A changed Firebase project applies at the next app start.
- Without Firebase, or without Play services (token fails), the inbox is
  checked every 15 minutes (WorkManager); with pings, every 2 hours as a
  safety net. The app also checks on start.
- `firebase-messaging` pinned at 25.0.2: 25.1.0 deprecates `getToken` /
  `onNewToken` for installation-ID registration, which the server's
  token-based send doesn't use.
- Android 13+: Places asks for the notification permission once.


## 2026-11 — Endurance days, finishers, 5/3/1 misses (v0.549.0, server 0.754.0)

- 0.548.0 didn't compile: a private `clockOf` in ProgramsScreen clashed with
  the internal `clockOf` in MovementSetsScreen (a private name doesn't hide
  an internal one from the same package). Renamed `enduranceClock`; 0.548.0
  never shipped. Before packaging, check new top-level names against
  internal ones across ui/workout, not just against other private ones.

- Other days: Endurance with its window (Long steady / Intervals / Circuit),
  picks in the web's format (`EndurancePick`, `enduranceIds`).
- `FinishersStep` gains a row per lift day (None / Core / Holds / Carries,
  each opening `OtherDayWindow`); `StartProgramRequest.finishers`,
  `CurrentSetupDto.finishers`.
- `rotationWord` and the movement filter know `endurance` and `carry`.
- What's next shows a drop (amber, "−15") when `suggest` is negative.

## 2026-11 — Rest days; Other days windows (v0.547.0, server 0.753.0)

- `RestSquare` (Canvas: pale slate square, a moon cut from two circles), on
  Workout days for `HeatMapDto.restDays` and in This week for `rest` days.
- `OtherDaysStep` opens `OtherDayWindow` for an add: `coreWorkouts(kind)`,
  `warmupRoutines(kind)` or the pool's WEIGHTS movements of a group. Picks go
  on the kind (`splitOther` / `joinOther`, the web's format); labels and the
  review read the kind without them.

## 2026-11 — Plateau card (v0.546.0, server 0.752.0)

- `ProgramsDto.plateau` (`PlateauDto`); `PlateauCard` under the plan card on
  Workouts. Answers go to `POST workouts/plateau`; the card hides at once and
  the page reloads (Swap then opens Your plan).
- Try → Preview → Start opens `Route.ProgramsStart(key)`: `ProgramsScreen`
  with `startKey` picks that program once its list loads (asking Your
  version / Default first when there is one). New plan opens Change.

## 2026-11 — Day page: always the list, plainer states (v0.545.0, server 0.751.0)

- `view` is "list" unless a block is picked; no auto-open of the only open
  workout. `programInView` follows the pick only.
- `DayHeader(late = …)`: the date is in `strip.overdue` (replaces the
  logged/planned guess). `time`/`onTime`, `TimeChip` and
  `WorkoutTimeDialog` are gone; the plan card shows its usual time as text.
- `DayWorkoutsList(future = …)` hides progress; Complete / Logged · N min /
  Skipped / Didn't go; Did you go? only when `DaySportDto.ended`.

## 2026-11 — Two programs at once, part 2 (v0.544.0, server 0.750.0)

- `WorkoutPlanDto.programBlocks` (`DayProgramBlockDto`), kept in the UI state
  only with two or more. Each becomes a `DayBlockUi` keyed `prog:<id>` with
  its own name, parts, progress, Done or Skipped.
- `programInView` picks the open program (the one tapped, else the only one
  still open when no sport is); the screen narrows `blocks`, `simple`,
  `picks` and `conditioning` to its `plannedWorkoutIds`, so everything below
  works unchanged. The collected state is `uiAll`; `ui` is the narrowed copy.
- Skip / Unskip calls `POST workouts/program-skip`.

## 2026-11 — Two programs at once, part 1 (v0.543.0, server 0.749.0)

- `ProgramsDto.also` (each a `ProgramInfoDto` with `setup`), `id` on every
  program; `StartProgramRequest.add` / `programId`; `programId` on end and
  next-block requests.
- ProgramsScreen: extra programs under the first with What's next and End,
  Add program (`adding`: programs only, setups with `alongside`, which hide
  the plan-wide steps; a third asks first), `startAdding` (Route.ProgramsAdd)
  and `editProgramId` (Route.ProgramsEdit(programId)). Ending the first with
  another running takes only its days.
- The setups step by name (`steps` / `cur`), so alongside can drop steps.
- Plan card lists extra programs with What's next; Add program; End with
  two running opens Programs. Your plan has a Program section per program.

## 2026-11 — Other days and What's next (v0.542.0, server 0.748.0)

- Shared setup steps in ProgramsScreen.kt: `OtherDaysStep`, `WarmupStep`,
  `CardioStep`, `FinishersStep`, `ReviewWeek`, with `startOther` (same
  program keeps each day; a new one keeps rest days) and `otherPayload`
  (sends `other`, adds cardio and conditioning picks to those days). The
  classic setup and `BlockBuilder` both use them; the builder's Days step
  no longer offers Core or Rest.
- `WhatsNextDialog` replaces `CycleEndDialog`: per-lift +step / Same from
  `ProgramInfoDto.check`, Continue, New plan, and the harder program's
  preview.
- The day page waits on `programWait` (program.blockDone): a card with
  What's next? opening Programs (`onWhatsNext`, Route.Programs), which
  bumps `programsChanged` so the day reloads.
- Success marks: the plan card's cycle and "↑ Cycle N done" line, and
  `MovementTargetDto.up` on the lift page.

## 2026-11 — Plan card and one setup style (v0.541.0, server 0.747.0)

- `PlanCard` (WorkoutsScreen) replaces `ProgramSummaryCard` and the Edit plan
  button: program or My plan, `WeekStrip` from `ProgramsDto.plan`, Edit /
  Change / End (End program asks Go back / Keep; End my plan sets the plan's
  end to today). Saved plans (`SavedPlansScreen`, `Route.SavedPlans`) holds
  `PlanLibrary` and `PlanFileActions`, moved from the plan editor.
- EditPlanScreen ("Your plan") has a Program section; Change movements opens
  `Route.ProgramsEdit` (`ProgramsScreen(startEditing = true)`), which edits
  any program in place (classic setups take `editMode`), then bumps
  `planChanged` so the plan reloads.
- `SetupStepHeader` and `ExtrasStep` are shared by the classic setup and
  `BlockBuilder` (which gains an Extras step). Rotation reads Rolling plan.

## 2026-11 — Cardio colours and x of y (v0.540.0, server 0.745.0)

- `WeekBars` (EnduranceCharts.kt) takes `parts`: each week's kinds stacked
  bottom first with 1dp white seams. Colours come from the server as hex
  (`CardioPartDto.color`, `CardioLineDto.color`, `CardioActivityDto.color`),
  parsed by `cardioKindColor`, which falls back to the one Cardio blue.
- `WorkoutSummaryCard` takes `blocks` (`DashboardDto.workoutBlocks`): with it,
  "N of M workouts" heads the remaining or the names, Complete for today!
  needs all of them done or skipped, and Rest day doesn't show.
- Weekly training draws the Planned line from `plannedParts` (null: none);
  `planned` stays for "x of y planned days".
- Cardio kinds add Hike and Walk (distance).

## 2026-11 — Build fix for workouts as blocks (v0.539.0, server 0.744.0)

- 0.538.0 did not compile: `DayWorkouts.kt` declared `clockText(min)` and
  `SectionLabel`, which clash with `clockText(sec)` in Timer.kt and the
  internal `SectionLabel` in CardioBlock.kt (same package). Renamed to
  `timeOfDayText` and `BlockSectionLabel`; the weekday list is
  `WEEKDAY_NAMES`. New top-level names in `ui/workout` are checked against the
  package first.

## 2026-11 — Workouts as blocks (v0.538.0, server 0.744.0)

- `DayWorkouts.kt`: `DayBlockUi`, `orderDayBlocks`, `DayWorkoutsList` (cards
  with a coloured edge per type), `SportPage`, `WorkoutTimeDialog` (Material
  TimePicker, as elsewhere in the app) and `UsualTimesScreen` (Settings →
  Workouts → Usual workout time, `Route.SettingsWorkoutTimes`).
- `WorkoutLogScreen` decides the view from the day's blocks: the list while
  two or more are open, else the single open one; system back and
  "← Today's workouts" return to the list. The planned page no longer offers
  the sport warm-up or the "warm up for the sport" switch; both live on the
  sport page.
- `WorkoutLogViewModel`: `sports`, `workoutTime`, `setWorkoutTime`,
  `answerSport`. Weekly training adds Core and Isometric kinds.

## 2026-11 — ⓘ on every movement list (v0.537.0, server 0.743.0)

- `MovementInfoByName` (MovementInfo.kt): the ⓘ for lists that only carry a
  name. The how-to comes from the shared pool (`workouts/pool`), loaded once
  per app run. Added to ConditioningCard, ConditioningPicker (both lists),
  Family WOD (day and choice, using `moveNames`) and the core workout peek.

## 2026-11 — Faster Summary weeks (v0.536.0, server 0.740.0)

- `SummaryViewModel` keeps the ranges seen this visit (view|from|filter),
  shows a cached one at once and refreshes it quietly, prefetches the range
  before the one shown, and asks with `goal=0` after the first load (the family
  goal is kept from that load). Only the newest request updates the screen.
- `SummaryDto.familyGoal` is nullable; an older server always sends it.

## 2026-11 — A side menu that never scrolls (v0.535.0, server 0.739.0)

- `KairosRail`: the section list sits in a `BoxWithConstraints`; row pitch is
  `(maxHeight - 8dp) / sections`, held between 36 and 48dp (rows 32–44). The
  scroll stays as a fallback below that. "Update available" takes ~36dp and
  the rows absorb it.
- Header 64 → 56dp. The open footer is one row: avatar, name with
  `v${VERSION_NAME}` under it, switch, collapse; the separate Collapse/version
  row is gone. Collapsed is unchanged.

## 2026-11 — Repeat wording, again (v0.534.0, server 0.738.0)

- `repeatLine` now says "…was removed because it is in another workout today."
  The other workout may not be done yet, so "already completed" was wrong.

## 2026-11 — Repeat wording (v0.533.0, server 0.737.0)

- `repeatLine` now builds "X was removed because it was already completed
  today." (or "X and Y were…"); the card shows it on its own line.

## 2026-11 — One movement, one card a day (v0.532.0, server 0.736.0)

- The server marks a movement already on an earlier card that day with
  `repeatOf`. The day page leaves it out of that card's group screen (so its
  sets and "how did it feel" aren't loaded there), and the card's line and the
  group screen say "Hollow hold in Core". `Route.CoreWorkout` gains `note`.

## 2026-11 — Docs match the app (v0.531.0, server 0.735.0)

- README, ARCHITECTURE and RELEASING checked against the code: stack versions
  (AGP 9.4.0, Gradle 9.6.0, SDK 37, Compose BOM 2026.09.00), Room, CameraX
  and ZXing, nine colours and eight backgrounds, Summary, the QR join and the
  tour. Open work is listed only at the top of the web repo's ROADMAP.md.

## 2026-11 — Garage length, bodyweight rows, work calendars (v0.530.0, server 0.734.0)

- `BlockBuilder` takes `garageFeet` / `onGarage` (null when the phone can't
  change it, from `canEditGarage`); a RollPicker of 10–60 ft sits at the end
  of the finisher card and saves through `POST /workouts/garage`.
- Lift rows add " reps" for a bodyweight series (`unit == "reps"`).
- `MonthChip` draws an external event solid when its kind is WORK.

## 2026-11 — Summary screen (v0.529.0, server 0.733.0)

- New "summary" section (last in `APP_SECTIONS`) → `SummaryScreen` in
  ui/character: `FamilyGoalCard` (moved off Characters, now internal) and
  the completion card from `GET /summary`: Week / Month, area chips, ‹ ›.
  More than one person: a row each (month as compact squares); one person:
  their week row, or their month as a calendar. Tapping a day opens a bottom
  sheet from `GET /summary/day` with "Done Mon" / "From Sun" tags.
- The Characters tour line no longer mentions the shared reward. No tour stop
  for Summary.

## 2026-11 — Odd squad builder and progress charts (v0.528.0, server 0.732.0)

- A program with `builder` opens `BlockBuilder` (new file) instead of
  `ProgramSetup`: Days (a weekday picker dialog per day), Blocks, Movements,
  Review, the same as the web. It keeps the plan's warm-up, cardio and
  conditioning days as they are and sends `coreDay`. Edit on the running
  program's card reopens it on `setup` (same week); the cycle's "with
  changes" opens it too.
- `WorkoutChart`: `liftTrend` follows est. max for a program's main lift
  (`program`), reps for a `fixed` movement, else the top weight; Holding /
  Stopped replace Flat. The lift page adds the trend and weeks-in-a-row chips,
  an Est. max / Top weight / Volume switch (Reps / Density / Time when fixed)
  with dashed top-weight and training-max lines, and a 12-week consistency row.
- A shuttle carry's reps field reads "Lengths". The garage length is set on
  the web (Admin → Workouts → Equipment).

## 2026-11 — Preview a future day's movements (v0.527.0, server 0.731.0)

- The future day page no longer swallows every tap: `DaySectionView(preview)`
  lets a movement card open; Core cards, removes, block cards and the other
  sections still consume taps. `MovementSetsScreen` treats a date after today
  as a preview: faded rows that don't react, "Preview · <day>" under the name,
  no Swap, no bottom bar, no suggestion, and Back leaves without `leave()` (so
  nothing saves).


## 2026-11 — Start over in Edit plan (v0.526.0, server 0.730.0)

- Start over left the Bible pages: personal is a text button at the bottom of
  `PlanOverview` (Edit plan); family is web-only. The Bible buttons use
  `outlinedButtonColors(containerColor = Color.White)`. The Start over page's
  box is "NOTE" with bullets.


## 2026-11 — Bible round 3 in the app (v0.525.0, server 0.729.0)

- The ⋮ PlanMenu is gone (its style didn't fit). Family (admins): Add readings
  and Start over buttons. Personal: a 2×2 of Edit plan, Log, Add readings,
  Import / export; Start over is a text button beside "Progress since".
  Family import / export are web-only.
- `BooksPage`: full screen, a card per section, three tiles a row; opened from
  the Bible / OT / NT cards and the Sections card. The dialog is gone.
- `AddReadingsPage` is three steps: What (testament → section → book →
  chapters with a breadcrumb, or typed), How (`ChoiceCard`s: Additional
  readings / Insert into the plan, the insert end date from a preview), Review
  (server preview of the chosen mode).
- `StartOverPage`: keep the plan, or (personal) end it — `deleteReadingPlan`
  then start over — and open a fresh `PlanWizard` (NEW_PLAN, so the old plan
  can't seed it).


## 2026-11 — Tracker books in a dialog (v0.524.0, server 0.727.0)

- The book grid moved into an AnimatedDialog opened from the Bible / OT / NT
  cards (clickable OutlinedCard) or a section row; it scrolls (max 520dp).
  Milestone filter chips are gone — the server sends at most five, rolled up.


## 2026-11 — Start over (v0.523.0, server 0.726.0)

- Plan ⋮ menu: Start over (family for admins, and mine), confirmed in an
  AnimatedDialog → `POST reading/tracker {action:"startOver"}`. The bars come
  from the server, so a started-again book needs nothing here.


## 2026-11 — Bible tracker in the app (v0.522.0, server 0.724.0)

- `BibleTracker.kt` `TrackerSection` mirrors the web tracker: Bible / OT / NT
  cards with ×counts and progress, sections with ×pills, a book tile grid,
  milestones with filter chips and bests. It replaces `ErasCard` (deleted) and
  shows once `GET reading/tracker` loads; until then the old cards show.
- Log reading: `ManualRunRow` with Reset (AnimatedDialog confirm) →
  `POST reading/tracker {action:"reset"}`. "Start a new era" is gone from the
  ⋮ menu. The tracker calls are never queued offline.
- `MarkReadingRequest.iso` sends the day's date, so a day with an extra is
  marked as that day.
- Add readings hides the fit choices when the plan ends when its readings are
  done (`family.endsWhenDone`, `plan.endKind == "DONE"`).


## 2026-11 — Bible eras, adding readings, import / export (v0.521.0, server 0.723.0)

- `BibleEras.kt` `ErasCard` mirrors the web ReadingEras: this era's sections
  (thick bar) against any earlier era (thin, faded, picked from a menu), OT
  purple and NT blue, the passes badge and the list of eras. It replaces the
  plain sections card once `GET reading/eras` loads (family, and mine when
  there's a personal view); until then the old card shows.
- A ⋮ plan menu: on "Family reading" for admins (role ADMIN, the server's rule)
  and next to Edit plan / Log for everyone. Add readings, Import a plan, Export,
  Start a new era (confirmed in an AnimatedDialog).
- `PlanEdit.kt`: Add readings — pick chapters (tap = a day, long press = the
  last reading's day) or type passages; push back / add to days / some of each.
  Preview and save go to `reading/plan/add`, so the server's rule is the only
  one. Import — paste or open a text file; start date and weekdays appear only
  when no line is dated. Export saves through the system file picker
  (CreateDocument). Parents get a Family plan / My plan switch on both.
- All of it is online only (not queued).


## 2026-11 — Who voted on the family goal (v0.520.0, server 0.720.0)

- `CoopProposalDto.voterNames` (parents only, from server 0.720); the Family
  goal screen adds "Voted: …" under an idea's vote count when it has any.
- The game warm-up's change is server-side only (it no longer counts toward
  the workout), so the home card simply stops listing it.

## 2026-11 — In-app QR scanning (v0.519.0, server 0.719.0)

- CameraX (preview + ImageAnalysis) with ZXing core's `QRCodeReader` on the
  brightness plane, in our own full-screen `QrScanDialog`
  (`ui/auth/QrScan.kt`), not the maintenance-mode zxing-android-embedded.
  Apache 2.0, no Play services, so it works on GrapheneOS. Pinned CameraX
  1.4.2 and zxing core 3.5.3; bump only those lines if Gradle flags them.
- CAMERA is asked for only when Scan code is tapped (`uses-feature` camera
  not required); refusing it leaves typing the code.
- `parseJoin` reads a bare code, a pasted link or the QR
  (`kairos://join?token=…&server=…`). Set up: Scan code sets the code and, with
  a server in the QR, fills the address and connects, then the invitation
  opens. Set up / Reconnect (AuthFlow): Scan code fills the code; a server in
  it is ignored there. A `kairos://join` link opened by the phone's camera
  passes its server through `pendingJoinServer`, used only before a server is
  set.
- Home workout card: "Left" → "Remaining".

## 2026-11 — The tour resumes where it was (v0.518.0)

- Replaces 0.517's "seen as it starts". Each stop is saved as it comes up
  (`tour_at_<person>`: "full:<stop id>" or "new:<stop id>"); Done or Skip marks
  the tour seen and clears it. On the next open a saved stop restarts that tour
  at that stop (the first stop if it no longer exists). Replaying from Settings
  works the same way.

## 2026-11 — "Logged" means finished; the tour never replays itself (v0.517.0, server 0.717.0)

- Exercises carry `open` (server 0.717). The day page's Logged chips, the
  Core/Arms card's "Logged" and count, a block's tick and the day's progress
  treat an open movement (sets left, Log not pressed) as not done. A save
  updates `open` locally right away.
- The tour is marked seen when it starts, not when it ends: an app closed
  mid-tour no longer shows it again. Tours after updates (`WHATS_NEW`) are
  added only for big updates, with the owner's approval.

## 2026-11 — Workout "Left" list and a smoother tour (v0.516.0, server 0.716.0)

- Set saves send `open` (sets left, Log not pressed); Log saves once more
  with `open` off even when nothing changed, so the movement counts as
  finished. The home workout card shows "Left" and `workoutRemaining` once the
  day is started and not finished.
- Tour: the box stays hidden while a page opens and scrolls (until its target
  holds still for 100 ms, at most 1.6 s), then fades in where it belongs;
  the dim level eases between stops. The box and its pointer get a 1.5 dp
  accent edge so it stands out against a white card. Rail stops navigate home
  without `go()` (its drawer close raced the open and won, so the Settings stop
  showed Home with the menu shut). Calendar line names the sliders icon;
  Reading's first line is "Add books and log reading."

## 2026-11 — EZ bar sets get the plate calculator (v0.515.0)

- A weighed movement whose name has "EZ bar" (`isEzBar`) shows the plates
  button on each set in place of × (the same button a program's fixed sets
  have), and its calculator opens on the EZ bar (19 lb) with that set's weight
  loaded; Use puts the weight back into the set. Works on a movement's own page
  and on the one-screen Arms/Core day.
- `Route.WeightCalculator` gains `bar` ("ez" or ""); `WeightCalculatorScreen`
  takes `startBar`. The Core day screen now wires the calculator at all
  (`onOpenCalculator`, `usedWeight`), so a program's fixed sets there open it
  too instead of doing nothing.
- Name-based on purpose: no server change. An EZ bar set can't be removed
  from the set list (like a program's fixed sets); Add set still works.

## 2026-11 — No class approvals (v0.514.0, server 0.714.0)

- Removed Settings › Parents › Class approvals (`SchoolApprovalsScreen`,
  its ViewModel, `Route.SchoolApprovals`, the `school/approvals` calls and
  DTOs) and the approvals dot on the menu's profile (it now only means an
  update).
- Add class: Semester is optional, with "No semester" first in the list, and
  "+ Add a new semester" is gone (semesters live in the web admin).
  "+ Add a new subject" only shows to admins; the server refuses a new subject
  from anyone else. `CreateClassRequest` loses `newTermName/Start/End`.
- Needs server 0.714 (the server drops the approvals route).

## 2026-11 — The app tour (v0.513.0)

- Mocked up and worded with the user on the design canvas first. A tour box
  with a pointed edge sits over a dimmed screen and walks through the menu,
  every page, the Workouts screen in seven parts, and Settings (Appearance,
  Notifications). The box has "n of N", a progress bar, Skip tour, Back and
  Next. Back (system) steps back; on the first stop it ends the tour.
- `ui/tour/Tour.kt`: the stops (`TOUR_STOPS`), `Tour` (the running tour and
  target rects), `Modifier.tourTarget(key)` (records bounds in root and scrolls
  the target into view when its stop comes up) and `TourOverlay` (drawn last in
  AppRoot, over the menu, swallowing taps underneath). AppRoot opens each
  stop's page: "rail" opens the menu, "section:<key>" navigates there,
  "settings" opens Settings.
- A stop with a target cuts a hole around it; a page stop (Tasks, Chores,
  Bible reading, Reading, School, Money, Game time, Ice time, Characters)
  dims lightly so the page shows through, with the box near the bottom. A
  target that isn't on screen (no data yet) falls back to the same.
- Lines marked for parents only show to parents (`kind == PARENT` or ADMIN).
  Pages hidden for someone (`navHidden`) are left out of their tour.
- Seen state is per person on the phone (`tour_seen_<id>`, `tour_tips_<id>`).
  0 = never: the full tour shows once on first open (everyone, after this
  update). `WHATS_NEW` holds stops for later features, each with the
  `TOUR_VERSION` that added it. After an update they show behind a "What's
  new" intro, if tips are on. It's empty for now: bump `TOUR_VERSION` and add
  stops with a release.
- Settings › Help & about gains **Take the tour** and **Tips for new
  features** (On/Off).
- Not covered yet: the Log workout screen (warm-ups, sets, Switch). That
  could be its own short tour.

## 2026-11 — Overdue chores tinted (v0.512.0, server 0.713.0)

- The server now keeps a superseded chore one extra day (overdue) so it can
  still be logged. `ChoreCheckRow` gives overdue, unfinished, completable rows
  the same light red tint as behind school work (`error` at 6%). Expired rows
  (not completable) stay untinted.

## 2026-11 — A one-day Switch picks from the plain list (v0.511.0, server 0.711.0)

- The day window's Switch opened the plan's chooser, so a plan set to Match
  the day opened on that tab with only Save (and saving "match" for one day
  isn't valid). `WarmupChooser(oneOnly = true)` hides the Match / Rotation
  switch and opens on the routine list, like the web's day Switch already
  did. The plan builder's chooser is unchanged. No server change.

## 2026-11 — Switching a day's warm-up is for that day only (v0.510.0, server 0.711.0)

- The warm-up window's Switch posts `workouts/day-warmup { date,
  plannedWorkoutId, warmup }` with the Workout log's date instead of
  `workouts/plan/warmup`, so it no longer rewrites that weekday's plan entry
  or replaces a rotation. `RoutinePicker` takes an optional `date`; without
  one (the plan builder's routine line) it still saves to the plan.
- Needs server 0.711; on an older server the Switch call fails with the
  usual error line.

## 2026-11 — Backgrounds, Graphite and a tidier Appearance screen (v0.509.0, server 0.710.0)

- `BackgroundScheme` (CLASSIC, STONE, MIST, LINEN, SAGE, LAVENDER, BLUSH,
  TWOTONE) picks the neutrals per phone (`background_scheme` in DataStore,
  default CLASSIC), independent of `ThemeScheme`. `neutrals(b, dark)` returns
  page, card, chip, muted, line, outline and ink; CLASSIC returns the app's
  original constants exactly, so nothing changes until someone picks. The
  outline of a new background sits 35% of the way from its line to its muted
  text. Same names and colors as the web.
- `ThemeScheme.GRAPHITE` (#4F4B46; dark #C9C4BC on #1C1A17).
- `KairosTheme(background = …)`; MainActivity and WidgetAddActivity pass it.
  The home-screen widget keeps the Classic neutrals.
- Appearance: a live preview card, Light or dark (unchanged), Color as one row
  of dots with the name on the right (replacing one row per color), and
  Background as eight tiles in two rows of four, drawn in the current mode.

## 2026-11 — Bodyweight work-up hints start from last time (v0.508.0, server 0.708.0)

- A program's target filled every set's hint, so 5 × 10 pull-ups showed 10
  in each box, and ticking an empty box logged 10, even for someone at 3.
- `workUpHint` in `MovementSetsViewModel`: for a reps or timed movement (not
  `WEIGHT`) and a target set with no weight and not a warm-up, the hint is
  last time's reps (or seconds) for that set. The scheme line keeps the
  target. First time, warm-ups and weighted sets are unchanged. Same rule as
  the web (0.708); no API change.

## 2026-11 — Monthly tests compare with the last test (v0.507.0, server 0.707.0)

- The test card's "Last time" and the hints inside it came from the last day
  the move was done. Isometric's holds are also in its regular workouts, so
  that was usually a 3 × 30s day, not last month's max.
- Server 0.707 sends the last test as `last` for test movements on the day
  payload (the plank card needed no change), and `workouts/sets?test=1`
  returns the last test as `last`.
- The test card marks its block `isTest`; its moves carry `test` through the
  Core screen route (a fifth field, so older routes still decode) to
  `MovementSetsViewModel`, which asks with `test=1`. Its view-model key gets
  `:test`, so a hold that's also in the day's workout keeps its own state.
- The Isometric test card shows "Last time 1:35 · 1:02 · 0:48" before
  anything is logged.

## 2026-11 — ROG Ally on Game time (v0.506.0, server 0.706.0)

- The game-time collector (5.0.0) adds a third source, `"ally"` (a ROG Ally
  handheld, via Microsoft Family Safety). It arrives in the same `platforms`
  list the screen already reads; no API change.
- `PlatformIcons` now draws from one ordered list (Xbox, Steam, ROG Ally),
  matching the web. The Ally has no logo of its own, so it shows the Republic
  of Gamers mark from Simple Icons (`KairosIcons.Rog`, the same source as the
  Steam glyph) in ROG red, described as "ROG Ally".
- A value not in the list draws nothing, so a future source can't break the
  row.

## 2026-11 — Paused classes on the School card (v0.505.0, server 0.703.0)

- Server 0.702 lets a parent pause a class for one student: no schedule, one
  open lesson at a time. A paused class has no pace or finish date, so the
  progress row would have shown nothing on the right.
- `SchoolCardProgressDto` gains `paused`, `done` and `total` (server 0.703).
  The home School card and the School screen show a grey "paused" tag and
  done/total in place of "finishes …". Defaults (`false`, 0, 0) keep an older
  server's rows exactly as before.

## 2026-11 — Passwords need 8 characters (v0.504.0, server 0.699.0)

- The join/reset screen asked for 6 characters while the server's
  change-password asked for 8. Server 0.699 uses one `MIN_PASSWORD` (8)
  everywhere, including `/auth/join`, so the app's check moves to 8 to match.
  Without it, a 6–7 character password would pass the app and then be refused
  by the server. Existing passwords are unaffected; this applies only when a
  password is set.

## 2026-11 — Every pop-up on AnimatedDialog (v0.503.0, server 0.696.0)

- All 43 stock `AlertDialog`s in 22 files (workouts, Appearance, Default
  reminders, Assign task, the calendar's discard / class prompts, Save address,
  the sign-in Forgot / Recover dialogs) are now `AnimatedDialog`.
  - It was a mechanical conversion: `title = { Text(x) }` became `title = x`,
    the `text` slot became the content, and an empty `confirmButton = {}` was
    dropped.
  - No stock `AlertDialog` is left in the app; new pop-ups use
    `AnimatedDialog`.
- `AnimatedDialog` puts its content in `Column(Modifier.weight(1f, fill =
  false))`. Long content (a Workout days breakdown, a program's choices) now
  shrinks before the buttons leave the screen, as Material's dialog does.
  Short dialogs look the same.
- Server 0.696 needs no app change: full-body moves and the 12-week range
  only change what the server sends inside the same shapes.

## 2026-11 — Remaining sets removed; dead heat code removed (v0.502.0, server 0.695.0)

- The −5 / 0 / +5 "Remaining sets" row on the log-a-movement screen is gone:
  the row, `RoundStep`, `shiftBy`, `step` and `MovementSetsUi.shift`. It only
  moved the grey hints of sets not entered yet, so hints are now last time's
  or the program's weights, unchanged. `hintW(r)` is just `r.hintW`.
- HeatView.kt lost the pre-0.664 range view: `HEAT_RANGES`, `HeatRangeChips`,
  `heatFills`, `heatAvailable`, `heatShade`, `HeatKey`, `HeatDetailDialog`,
  `HeatStat`. The 0.501 docs entry called them unused "range code", but
  `HeatMapDto.ranges` (the "12w" range) still feeds `HeatGroupSummary`, so
  the DTO and `HeatBests` stay.

## 2026-11 — Docs brought current (docs only, no app release; server 0.695.0)

- README and ARCHITECTURE caught up with 0.390–0.501. They now cover the
  Settings layout, the home-screen widget, the background timer, programs,
  the heat map, Family WOD and pauses.
- ARCHITECTURE gained two sections. "Pages, not sheets" records the
  `FullPage` rule (no `ModalBottomSheet` anywhere; some file names still say
  Sheet). "Settings" records where a new setting goes.
- RELEASING gained the positional-args check (237; must not rise).
- No code changed, so `versionName`, `versionCode` and `CLIENT_BUILD` stay
  at 0.501.0 / 573 / 573 and there's nothing to tag. `HeatRangeChips` /
  `HEAT_RANGES` in HeatView.kt look unused since the 0.664 redesign. They
  are noted, not removed.

## 2026-11 — Settings reorganized (v0.501.0, no server change)

- Settings: a profile card (PersonAvatar, name) on top, then grouped rows
  under uppercase labels (`SettingsLabel`, shared by the settings pages):
  Account (Password, Devices, Sign out or switch), Look & feel (Appearance),
  Notifications (Notifications & reminders), Connected apps (Concept2),
  Parents (Class approvals, admins only, count badge), Help & about (How
  scoring works, Software update with the version or a "New" badge,
  Diagnostics).
- Devices had a route and screen but nothing navigated to it; Settings now
  does. Sign out from Settings raises the rail's own "Sign out?" dialog.
- Notifications & reminders: the old Default reminders screen is
  `DefaultRemindersCard`, shown between the alert switches and Sound. Its
  route stays and shows the same card on its own page.
- Appearance keeps every control, regrouped: App (light or dark, colour
  theme, time format), Home screen widget, Workout timer (look, numbers,
  number colour, when you leave the app). The user chose to keep widget and
  timer here rather than a separate "On this phone" group.
- New icons: `KairosIcons.Phone`, `KairosIcons.Link`.

## 2026-11 — Endurance ⓘ text (v0.500.0, server 0.690.0)

- Only the ⓘ copy changes; carries and endurance scoring are server-side.

## 2026-11 — Heat map earned by progress (v0.499.0, server 0.689.0)

- Scoring is server-side; the app only adds `TrainGroupDto.since` (shown
  small under the reason line) and the new ⓘ text. No map toggle.

## 2026-11 — Admin pauses for one person (v0.498.0, server 0.688.0)

- `WorkoutPauseDto.kind` can be "admin" (a parent's pause for this person,
  from Admin → Calendar): listed as "set by a parent", no End or Remove.
  The heat map's program and top-set fixes are server-side only.

## 2026-11 — Reason line; midnight rollover (v0.497.0, server 0.687.0)

- The map pop-up shows `TrainGroup.line` whenever there is one, rows or not.
- AppRoot checks `LocalDate.now()` each minute; a new day bumps
  `dataRevision` and `homeRefresh`, so Home and the section screens reload.

## 2026-11 — Training-kind colours; plan end date (v0.496.0, server 0.686.0)

- `WEEK_KINDS` and the endurance chart colours: Cardio 0xFF0EA5E9,
  Conditioning 0xFFC026D3, Sport 0xFF65A30D; cardio effort shades follow.
- Edit plan has Ends on under Starts on (`PlanResponse.weeklyEnd`,
  `setWeeklyEnd` → `POST workouts/plan/start {end}`).
- The heat map's sore holds need nothing new here: the server's lines and
  levels already carry them.

## 2026-11 — One Family WOD button; training maxes shown only (v0.495.0, server 0.685.0)

- `FamilyWodScreen` shows New family WOD to a parent and Suggest one to
  anyone else, never both.
- `ActiveProgramCard`'s `MaxRow` is text only; `onSaveMax` is gone. Maxes
  change through the cycle-end dialog or the program setup.

## 2026-11 — Range calendar; nine buttons (v0.494.0, server 0.684.0)

- `PauseRangeCalendar` on the pause page replaces the date dialogs and length
  chips: tap the first day, then the last (180 days at most); a third tap
  starts again.
- Family WOD, Pause and Recent are a third row of `ActionCard`s (icons
  Users, Pause, Clock); `familyWodLine` and `pauseLine` give their
  subtitles. `FamilyWodCard` and `WorkoutPauseCard` are gone.

## 2026-11 — Pie slices for any count (v0.493.0, server 0.683.0)

- Workout days cells with 3+ groups are a sweep gradient with one hard-
  stopped slice per group, no gaps and no cap (supersedes 0.492's tiles).
  The tap-a-day pop-up is how a crowded day is read.

## 2026-11 — Pages, not sheets; one Add flow (v0.492.0, server 0.682.0)

- `ui/common/FullPage` (a full-screen Dialog holding a Scaffold + TopAppBar,
  so it matches a navigated page) and `PageCard` (the white top card). Flows
  opened from a screen use it instead of bottom sheets or list pop-ups:
  `ConditioningPage` (Pick · Generator, replacing PickOneSheet/BuildOneSheet),
  `AddCardioPage` (from the Cardio card and from + Additional),
  `ExtraPickerPage`, `LogWorkoutPage` (was CustomWorkoutForm's window, now
  narrowed by kind via `logCategoriesFor`), the plan file pages and both
  swap-a-movement lists. WarmupScreens, CoreDays and EnduranceCharts' own
  full-screen helpers delegate to it.
- The day has one "+ Additional" button at the bottom; the Conditioning
  section shows only when there's a pick to make or a one-off result.
- Workout days cells with 3+ groups draw a tile grid (Column of weighted
  Rows) instead of sweep or band gradients.

## 2026-11 — Tap a day; Family WOD cards (v0.491.0, server 0.681.0)

- A Workout days cell with work is clickable: an AlertDialog lists each
  group (colour square, name) and that day's movements in it, from the
  series points (`movesByDate`). Days fed only by `extraDays` show the group
  without movements.
- The Family WOD edit page wraps day + workout in one `OutlinedCard` and
  who's in (or the note) in another; the workout list inside is a bordered
  column, not a nested card. People order comes from the server.

## 2026-11 — Full pages for Family WOD and pauses (v0.490.0, server 0.680.0)

- Routes `FamilyWod`, `FamilyWodEdit(date, wodId, suggestionId, suggest)` and
  `WorkoutPause`; the Workouts screen keeps `FamilyWodCard` and
  `WorkoutPauseCard` as summaries that open them. A board opens in place on
  the Family WOD page (Back returns). The edit page loads `?choices=1`, finds
  the WOD or suggestion by id, and suggests instead of setting for someone
  who isn't a parent. Saving sets `familyChanged` on the screen it came from,
  so the day reloads.
- Dates use `QuickDatePickerDialog`: a family WOD's day (today to 60 days),
  a pause's first day (up to a year ahead) and last day (up to 180 days on).

## 2026-11 — Family WOD (v0.489.0, server 0.679.0)

- `WorkoutDayDto.familyWod` drives `FamilyWodDayCard` at the top of the
  day: a member gets `ConditioningCard` with `badge` and `noSkip`, logged
  and rated like any conditioning; anyone else gets Join. The board follows.
- `FamilyWodPanel` on the Workouts screen loads `GET workouts/family-wod`
  itself (next, Board, Suggest one; parents: Coming up and Suggestions).
  "+ Additional → Family WOD" sets one for the day (a parent) or suggests it.
- Parents come from the server's `parent` flag; days step one at a time,
  today to 60 days on.

## 2026-11 — Workout pauses (v0.488.0, server 0.678.0)

- `WorkoutPausePanel` on the Workouts screen (it loads `GET workouts/pause`
  itself): household pauses read-only, the person's own with End, or "Pause
  workouts" (reason; 3 days, 1 week or 2 weeks from today). The day shows
  `WorkoutDayDto.paused`. The strip needs nothing new: paused days come as
  `restPlanned`.

## 2026-11 — Weighted holds (v0.487.1, server 0.677.1)

- A timed set row shows a weight box before the time when the movement log
  has `holdUnit`; the weight goes out with the set.

## 2026-11 — Swapped days, band-aid sore spots (v0.487.0, server 0.677.0)

- `WorkoutDayDto.swappedWith` → "Swapped with Friday this week · Undo"
  (`undoDaySwap`: suggestion answer `swap`/`undo`, then reload). The swap
  itself is a game-card answer (`swap:<dow>`), which reloads like the other
  `:` answers. Everything else follows the server's plan reads.
- `SoreSpots` lost "+ Sore spot" and its dialog; a band-aid icon leads each
  strip, and it draws nothing with no spots.

## 2026-11 — Smarter suggestions (v0.486.0, server 0.676.0)

- The new cards come through the same `SuggestionCard`; answers with a `:`
  and `lightweek` reload the day (the plan changed). `editplan` and
  `programs` also navigate (`WorkoutLogScreen(onEditPlan, onOpenPrograms)` →
  `Route.EditPlan`, `Route.ProgramsChange`). `lightweek` shows the day as
  lighter at once, like `light`.

## 2026-11 — Build fix (v0.485.1)

- `setSore` read `.sore` off the Retrofit `Response` inside `runAuthed`
  instead of off the unwrapped body.

## 2026-11 — Sore spots, hurt days rebuilt (v0.485.0, server 0.675.0)

- `SoreSpots` under the body map (strips with Better, "+ Sore spot" pop-up),
  `POST workouts/sore`; the map hatches each area (`BodyMap(soreFront,
  soreBack)`, `SORE_PATHS` mirroring the web's indices).
- Adjust today's Hurt uses the "Something hurt?" areas (Neck included),
  opens on the first sore area (`WorkoutDayDto.sore`), and has "Add a
  replacement for each move left out" (`AdjustRequest.replace`); stand-in
  lines are tagged Added (`AdjustLineDto.standIn`).
- A stand-in reaches the day as the slot's `loggedAs`, which the day and
  the movement screen already treat as a swap. Answering a day suggestion
  with `around:` reloads the day.

## 2026-11 — Build fix (v0.484.2)

- The recent-core-days DTO clashed with the existing `CoreDayDto` (core
  days); it is `CoreRecentDayDto`. New DTO names are now checked against
  every class in the app before packaging.

## 2026-11 — Chart pages line up (v0.484.1, server 0.674.1)

- Cardio's page gains a second row of tiles (Since best, Sessions, Last);
  Conditioning's page and the Core page end with recent sessions / core
  days, from the new server fields. Same order as a lift's page.

## 2026-11 — Cardio and conditioning charts (v0.484.0, server 0.674.0)

- `EnduranceCharts.kt`: `CardioChartCard` / `CardioPageDialog` and
  `ConditioningChartCard` / `ConditioningPageDialog`, from
  `heat.cardioCharts` / `heat.conditioningCharts` (worked out on the
  server). Named `…ChartCard` because `ConditioningCard` is the day page's.
- Shown after the muscle groups; `TrainDetailDialog(onOpenRow)` lets the
  Endurance pop-up's Cardio and Conditioning rows open them.

## 2026-11 — Core page order (v0.483.1, server 0.673.1)

- `CoreOverviewDialog` puts the chart before the tiles, the same order as
  `LiftPageDialog`.

## 2026-11 — Core card and page, this week in the map pop-ups (v0.483.0, server 0.673.0)

- Core is one card (`CoreCard`) from `heat.coreSummary`, worked out on the
  server (`core-progress.ts`); it opens `CoreOverviewDialog` (tiles, the
  progress line with plank tests, moves grouped Front / Sides and twist /
  Leg raises and crunches, "Not done lately"). A move opens
  `CorePageDialog` on top, now with Best, First and Change tiles;
  `coreMoveChange` mirrors the server's `moveChange`.
- `TrainDetailDialog` leads with `TrainGroupDto.week` (exact sets or
  minutes this week, a row per movement or kind) and shows the warmth line
  only when the week is empty. The bests list left it.
- Older servers send no `coreSummary`: Core falls back to the plank bench.

## 2026-11 — Steady body map, Core card, week strip snap (v0.482.0, server 0.672.0)

Heat view keeps the BodyMap full width with the EnduranceHeart in a Box at
TopCenter. Core: `CoreRows` is one card — a Plank test row (opens PlankBench
full screen), then the six most recent `CoreRow`s without sparklines, the rest
behind "All core movements (N)". `fillsFor` paints a LOWER_BACK series in its
own colour on the deadlift's region, a deadlift winning. Additional cards show
name and count; tap opens the lines in a dialog. The week strip's snap uses
`SnapLayoutInfoProvider(snapPosition = SnapPosition.Start)` — the default
centre snap left half days at both ends. Weekly training: dates row, category
names, fixed colours. Lift rows only draw the sparkline and trend when there
is one, so names get the room.

## 2026-11 — Weekly training chart, Core rows, sport warm-up card (v0.481.0, server 0.671.0)

`WeeklyTrainingCard` draws the server's `kinds` as stacked Canvas bars (lifting
in the accent; conditioning, cardio, sport, mobility in fixed colours), a
dashed line at `planned`, and the picked week's `dayList` as seven squares
(two kinds split diagonally; dashed outline for planned, amber for missed).
Core uses `heat.coreMoves` (`CoreRows`, `CorePageDialog`) instead of lift rows
or the hard-sets summary. The hinge family now arrives grouped as Deadlift
from the server. Day-card, lift-row, core-row and warm-up names allow two
lines. `SportWarmupCard` is an OutlinedCard with Skip and a check (POST
warmup-for `{ date, state }`, state always sent, "" clears).

## 2026-11 — Lift rows and a page per lift (v0.480.0, server 0.670.0)

WorkoutChart: each muscle group's lifts are an OutlinedCard of `LiftRow`s
(best/last, a Canvas sparkline of the last 12 top sets, `liftTrend`), replacing
`LiftBlock`'s six tiles and its "Additional charts". A row opens
`LiftPageDialog`, a full-screen dialog: rep-range chips, the dot chart with
light weeks shaded (points with intent LIGHT, by Monday), `heat.marks` as
amber ticks at the foot (named in the key and the tapped point's label), the
record ringed and `liftNext` (GET workouts/lift-next) drawn dashed ahead;
then six tiles with est. max (`estimatedMax`, the server's formula), the
rep-max card and the last five sessions. Lift progress left
ProgressSummaryCards. Weekly training moved up under the Progress card.
The Routines action card lost its subtitle: it wrapped to three lines in a
fixed 88 dp card and the last was clipped.

## 2026-11 — Custom recurrence is a full screen (v0.479.0)

Too much for a pop-up: `CustomRecurrenceDialog` is now a full-screen dialog
(the routine editor's pattern) with ← (drop) and Done (keep). Not a bottom
sheet: its number boxes bring up the keyboard, which pushes a sheet around,
and "On [date]" opens a date picker over it. Same settings as before.

## 2026-11 — Task repeats (v0.478.0, server 0.668.0)

AssignTaskScreen: with Repeat on, "First due" (the due date) shows and is sent
as `startDate` (it used to be today). "Repeats" offers Daily / Weekly on
<day> / Monthly on the <n> / Yearly on <date> (every one, from the first due
date; weekly sends that date's weekday) and Custom…, a dialog with Repeats
every N + day/week/month/year chips, weekdays for weeks, and Ends (Never / On
/ After N occurrences). Ends stays on the form too. The "Every X" field, the
monthly "Starts" field and the no-due-date notice are gone. A saved series
with interval 1 (and, weekly, just its start's weekday) opens as its preset,
otherwise as Custom. `taskRecurLabel` mirrors the server's `recurLabel`.
Needs server 0.668 for Yearly and intervals over 52.

## 2026-11 — "+ Additional" (v0.477.0, server 0.667.0)

The Conditioning section's button is "+ Additional": `AdditionalMenu`
(Conditioning opens the old Pick / Build / Write dialog; Mobility,
Stretching, Isometrics open `ExtraPickerDialog`, which lists
`warmupRoutines(kind)` or the new `coreWorkouts("iso")` and adds with
`POST workouts/extras`). The server sends extras as ordinary day entries
flagged `extra` (`WorkoutBlockDto.extra`, `SimplePlanDto.extra`), so their
cards, the Core logger, sets, skips and Mark done work unchanged with the
"extra_<id>" ids. Extras are left out of the progress bar; their cards show
✕ (`removeExtra`) instead of Skip.

## 2026-11 — Your version of a program (v0.476.0, server 0.666.0)

`ProgramsDto.versions` (by program key; empty from an older server). A
program with one shows an EDITED tag; picking it opens a dialog — Your
version (date), Default, Forget my version. Your version opens
`ProgramSetup` with `initial` = its setup, `current` = its extras,
`nextMaxes` = its training maxes and `fromVersion = true` (button says
"Start program"; a main lift without a saved max gets 90% of the best
logged). The setup is wrapped in `key(programKey, fromVersion)` so its
remembered state resets between Default and Your version. Forget calls
`POST workouts/programs/version/forget` and opens the default setup.

## 2026-11 — Back keeps drafts; warm-up ticks kept (v0.475.0, server 0.665.0)

`MovementSetsViewModel.leave(logTyped)`: the Log tile and "Finish for now"
pass true (logs typed, complete rows); Back (arrow, system back, the Core
screen's back) passes false and stores typed-but-unticked values in
`SetDrafts` (process memory, per date and slot), restored by `withDraft` on
load. `WarmupSteps` keeps ticks in `WarmupTicks` per plan entry, routine and
day.

## 2026-11 — Training heat map (v0.474.0, server 0.664.0)

The heat view reads `heat.training` (TrainingHeatDto): `trainFills` colours
each group by level (TRAIN_WARM 1–5, TRAIN_COLD −1..−3, the figure's grey at
0), `EnduranceHeart` draws the endurance level as a heart (path parsed from
the web's SVG), `TrainKey` is the legend with ⓘ, and `TrainDetailDialog`
shows the server's one-line reason plus the 12-week bests. The range chips
are gone (the stored range preference is simply unused).

## 2026-11 — Stretching; movement title fits (v0.473.0, server 0.663.0)

Stretching routines reuse the warm-up screens with kind "stretching"
(`routineKindOf`); a simple STRETCHING plan sits in the STRETCH section
(`simpleSection`). The movement screen's title (`FitTitle`) drops a sp at a
time from titleLarge to 15 sp while it overflows, then ellipsizes; Swap is
`SwapIconButton` (outlined circle, content description "Swap"). The day's
title comes from the server, which now names a non-program day by its plan.

## 2026-11 — Warm-up on a sport day (v0.472.0, server 0.662.0)

`sportDay` from `GET /workouts` drives it: the Warm-up window shows a
Workout / sport switch (`SportChoice`, `SegmentSwitch`) that posts
`workouts/warmup-for`; the Warm-up section always exists on a sport day and
shows `SportWarmupCard` (view-only routine with timers) while the planned
Warm-up isn't for the sport.

## 2026-11 — Isometric days (v0.471.0, server 0.661.0)

Isometric reuses the Core screens with kind "iso" (`rotationWord` names it):
Add workout's Isometric category gets the Core-style switch (rotation or
pick holds), the rotation editor offers isometric and timed movements, and
the day groups iso entries under "Isometric". The month's test is read from
`coreTests` / `coreTestName` (falling back to `coreTest`); more than one
test movement shows as one card that opens them together.

## 2026-11 — Day header date on one line; warm-up card trimmed (v0.470.0)

The date row had the date at `weight(1f, fill = false)` and a
`Spacer(weight(1f))` before the reset icon, so the two split the spare width
and the date could use only about half the card ("Saturday, November" / "7").
The spacer is gone; the row uses SpaceBetween so the date takes what it needs
and the icon stays at the end. The warm-up card no longer lists its steps
(0.468); they're inside when it's opened.

## 2026-11 — Mobility (v0.469.0, server 0.659.0)

Mobility reuses the warm-up screens with a `kind` ("warmup" | "mobility"):
`WarmupChooser` (One routine / Rotation for Mobility), `RoutinePicker`,
`RoutineEditor` (adds "How (optional)", a step's `cue`), `WarmupWindow` and
`WarmupPlanLine`. The day shows a Mobility section with `WarmupCard`; the
Workouts page's Warm-ups card is now Routines with a Warm-ups / Mobility
switch. Steps with a `cue` show an ⓘ that opens it.

## 2026-11 — Adjust today (v0.468.0, server 0.658.0)

`AdjustTodayScreen` (AdjustToday.kt) replaces `GoLightScreen`: the start
choices, then Low energy (preview, Confirm), Sick (Lighter / Easy day,
Confirm), Hurt (area chips, preview, Confirm; Rest / skip when nothing is
left to lift) or Short on time (time, picks with estimates, the can't-fit
fixes, preview, Confirm / Change). Estimates and previews come from
`POST /workouts/adjust`; the phone works nothing out itself. The day header
shows the server's `adjusted.label` with Undo. The warm-up card lists the
routine's steps under its name.

## 2026-11 — Game "How hard?": the check mark finishes it (v0.467.0)

Yes on a sport prompt shows the How hard? card again (0.466 dropped it by
mistake); an effort chosen with the check mark saves and closes it. "Skip"
remains; "Done" is gone.

## 2026-11 — Snap, one-tap game confirm, Additional edit (v0.466.0)

- The strip's LazyRow uses `rememberSnapFlingBehavior` (whole days).
- Home: Yes on a sport prompt no longer opens the "How hard?" card.
- Day page: "ADDITIONAL" (was LOGGED); a card with `sport` opens
  `SportEditDialog` (EffortChooser, and a minutes field when `flexTime`) →
  `POST /workouts/sport-session` (server 0.656+).
- GoLightScreen: "Any" (0) time. WarmupChooser: Match rows get ⓘ; Rotation
  rows copy CoreRotationPicker's numbered squares.

## 2026-11 — Warm-up modes (v0.465.0)

`WarmupChooser` gains a three-way switch (One warm-up / Match the day /
Rotation). Match lists the routines it picks from (`MATCH_WARMUPS`) and saves
"match"; Rotation numbers routines in tap order and saves "rot:<ids>". The
plan line reads "Match the day" or "Rotation · N". The day page needs
nothing: the server resolves the routine and adds Shoulder prep.

## 2026-11 — Go light (v0.464.0)

`GoLightScreen` (GoLight.kt, a CoreScreen full-screen dialog): question chips,
then the suggestion and alternatives as selectable cards, "Use this" →
`POST /workouts/go-light` apply. The day page shows "Go light" beside Rest /
skip on today until chosen, and DayHeader shows "Light day · <option> ·
Undo" from `goLight` (server 0.654+). The server trims the plan, so the cards
and completion need nothing else.

## 2026-11 — Week strip scrolls freely (v0.463.0)

`ScrollingWeekStrip` is a LazyRow over every day in reach (STRIP_DAYS_BACK
64, AHEAD 32), cells 1/8 of the width, no snap; ‹ › animate 7 items. The
LazyListState lives in DayHeader (initial item puts the shown day at the
right end) so a reset IconButton sits top-right of the card, shown only when
off today. Missing days render from the date alone; pages in view are
requested via `loadStripPage`, which now fetches each page once per day load
(`stripFetched`, cleared in applyPlan). `StripDayCell` is the old WeekStrip
cell, extracted.

## 2026-11 — Week strip holds still; quieter network log (v0.462.0)

- DayHeader owns the PagerState (initial page = the one holding the shown
  day) so "Today" can be a text link at the end of the date line: no extra
  row, no height change. PagedWeekStrip keeps a 56 dp floor per page.
- `loadStripPage` always refetches (the old page stays until replaced) and
  the page in view refetches whenever the day reloads (`LaunchedEffect(page,
  first)`); applyPlan no longer clears the pages — clearing blanked the page
  in view after tapping a coming day, and nothing asked for it again.
- No progress bar on a coming day.
- NetworkMonitor logs blocked/unblocked only while `foreground` (set in
  MainActivity onResume/onPause); losses and evidence-based changes always.

## 2026-11 — Week strip pages; Arms days (v0.461.0)

- `PagedWeekStrip`: a HorizontalPager of 8-day pages (8 back, 4 ahead) with
  ‹ › IconButtons and a "Today" TextButton; page 0 is the day's own strip,
  others come from `GET /workouts/strip?page=` (`loadStripPage`, cleared on
  each day load). The pager owns its swipe, like the Bible cards. A future
  day's sections are faded (55%) with taps consumed; Rest / skip,
  suggestion and benchmark are hidden.
- Arms days ride Core's screens with a `kind`: AddWorkoutSheet offers an
  Arms rotation when the muscle is Arms (`armsWorkouts`), CoreRotationDialog
  / editor / picker take `kind` (no plank test, arms movements to choose
  from, "New arms workout"), and CoreActions.save carries it. The day card
  and logger need nothing new (the server marks an Arms entry `core`).

## 2026-11 — Rest days look like rest days (v0.460.0)

`WorkoutSummaryCard` takes the dashboard's `workoutRest` / `workoutExtraLogged`
(server 0.650+): "Rest day!" in muted text, or "Complete for today!" for a
skipped day with something else logged; the card is listed on a rest day even
with no workout task. WeekStrip draws rest as a grey filled circle with the
date (no moon); `stripState` treats rested + logged as done and reads
`restPlanned`. A rested day's sections sit in a 40% alpha Column.

## 2026-11 — Offline bar corrected by evidence; longer, folded diagnostics (v0.459.0)

- "You're offline" came only from ConnectivityManager callbacks. After the
  phone slept it could stay up while the app was talking to the server (the
  log showed live requests going out under an "offline" bar) — most likely
  Android unblocking the app's network without a fresh onAvailable — until a
  screen change. NetworkMonitor is now a MutableStateFlow set by the
  callbacks (plus onBlockedStatusChanged) and also by evidence: any server
  answer through OfflineInterceptor (`onAnswer`), MainActivity.onResume
  (`recheck`), and SyncManager's 15 s probe, which now also runs while the bar
  says offline but the system reports a network.
- Each network change is a breadcrumb naming its cause ("network offline:
  lost", "network online: server answered"), so a stuck bar can be traced.
- Breadcrumbs: 150 lines (was 30, which a night of half-hourly widget draws
  filled), a date on each line, and an event repeated back to back updates one
  line ("widget draw ×6 since 11-06 03:19:07"). Diagnostics lines are 10 sp
  monospace — they're for copying.
- Ice time's "updated N min ago" is the rinks' check time carried in the
  data, so it stays right when the screen shows a saved copy: no change.

## 2026-11 — One minimum height for home cards (v0.458.0)

`HOME_CARD_MIN` (64 dp, the Workouts card's minimum since v0.436) now sets
the floor for every section card on Home: Chores, School, Workouts, Reading,
and the category blocks (Bible and the like, and Today's schedule, whose
"Nothing scheduled" line was the short one). Content centres vertically when
the card is taller than it. Prompts (money, family goal, sport) are taller
already and are left as they are.

## 2026-11 — Hockey renamed Ice time (v0.457.0)

Section label, screen title and empty-state text read "Ice time"; the icon
(`KairosIcons.Hockey`, name kept) is now an ice skate. The section id stays
"hockey", so saved section order and visibility carry over.

## 2026-11 — A planned rest day is a rest day (v0.456.0)

`restPlanned` (server 0.646+) hides Rest / skip, the suggestion and benchmark
cards, and every section (+ Conditioning included) on the day page; the title
comes from the server ("Rest day") and Logged lists whatever was done, rows
and conditioning included. Log an additional workout is unchanged.

## 2026-11 — "Logging late" only while nothing is logged, on every screen (v0.455.0)

v0.431 fixed the day page, but the set logger and the core workout screen
still showed "logging late" for any past day, from the route's `late` flag
alone. Both now show it only while none of the screen's sets are saved, the
same rule as the day page. (`late` itself still drives the completed-on date.)

## 2026-11 — Workout plan: "Saved" after each change, Done (v0.454.0)

Every plan change already saves at once. `EditPlanUiState.savedAt` moves on
each successful write (`act`, core workout save/delete, section order, the
warm-up picker's reload) and a Snackbar shows "Saved"; the Scaffold's bottom
bar is a full-width Done (the rotation page's Save style) that goes back. No
discard warning, since nothing is ever held unsaved.

## 2026-11 — Plank test card, Core plan line, plank tiles (v0.453.0)

- `WorkoutBlockDto.coreTest` (server 0.644+): on a core day with the monthly
  plank test, `DaySectionView` draws a "Plank test" MovementCard that opens
  CoreWorkoutScreen with just the plank, and the CoreDayCard leaves it out.
- `CorePlanLine` is now the warm-up's shape: the row reads "Core" and the
  workout's name is an accent link opening the rotation.
- `PlankBench` reuses WorkoutChart's `StatTile` (now internal) with a plain
  title, no frame — the same look as a lift's record tiles.
- The rotation fix (moves on at the next core day) is server-side only.

## 2026-11 — Plank test shows with Core's charts (v0.452.1)

`PlankBench` was only in the summary (no-charts) branch of WorkoutChart; Core
with a weighted carry is a charted group, so it never drew. Now it leads the
CORE block in both branches, and shows "No plank logged yet." when empty.

## 2026-11 — Plank test as core's benchmark (v0.452.0)

Core's summary under the body map leads with `PlankBench` (PlankBench.kt):
best, last, change, time to 3:45, days since best, test count, and a Canvas
chart of every test with dashed 1:10 / 3:45 lines. Data is `heat.plank`
(server 0.643+); an older server sends none and the card is simply absent.

## 2026-11 — Widget too big to send (v0.451.0)

The 0.450 breadcrumb caught it: `TransactionTooLargeException`, 1.2 MB. Every
event line's tap carried the whole event as JSON (notes, attendees, member
lists…) in its intent, and the widget sends a copy of its layout for each size
the launcher asks for — the Pixel launcher asks for more than one, so a busy
week passed Android's 1 MB limit there and not on GrapheneOS. A tap now
carries only the event's id and day (`EXTRA_EVENT_ID`, `EXTRA_EVENT_DAY`);
MainActivity finds the event in the widget's cached week (`WidgetStore`). The
old whole-event extra is still read, for taps from a widget drawn before the
update. The list also stops at 60 lines ("More in Kairos") so an unusually
busy week can't hit the limit another way.


## 2026-11 — Widget errors in Diagnostics (v0.450.0)

"Can't show content" on the widget is Glance 1.1's own error layout: drawing
the widget threw in the app's process (not a launcher problem). Glance says
nothing more, and a stock phone has no logcat to hand, so `KairosWidget`
overrides `onCompositionError` to drop a breadcrumb — the root exception's
class, message (160 chars) and the first frame in the app — then shows
Glance's default as before. Each draw also drops "widget draw" (and a failed
refresh), so Diagnostics shows whether the widget ran at all.


## 2026-11 — m:ss entry, narrower set boxes, SidesTimer (v0.449.0 / web 0.642.0)

`ClockField` shows a timed set as m:ss and reads typed digits from the right
(`secondsFromTyped`), keeping seconds in the row. Set boxes have fixed widths
(weight 88, reps 68, distance 76, time 96 dp) with a spacer before ✓ / ✕.
On the Core day screen, Timer picks the next movement with open timed sets;
one with `sides` (from `MovementLogDto.sides`) opens `SidesTimer` (Start on
Left/Right, 1/2/3 s pause, Switch keeps each side's time), and the times fill
that movement's open sets via `fillSeconds`. Others use the stopwatch, filling
one set.


## 2026-11 — Public skate's event type (v0.448.0 / web 0.641.0)

`HockeySectionDto` adds `kind` and `eventTypeId`. "Add" uses the section's own
type when the server sends `kind` (a public skate gets a skating type or
none), and the top-level `eventTypeId` from older servers.


## 2026-11 — Core day screen like 5/3/1; carry distance (v0.447.0 / web 0.640.0)

`CoreWorkoutScreen` drops the per-movement bordered blocks: `CoreMoveSection`
is a heading row (name, target, ⓘ) over the set cards, so the page reads
background → cards, like 5/3/1's sections. The bottom bar has Skip (every
movement), Timer (fills the next open timed set down the page via
`openToolFor(null)` + `useSeconds`) and Log. One `FeedbackCard` at the end
sets every movement's effort. No "Same as last time" there. `SetCard` takes
`repsUnit` ("yd" for a carry, from `MovementLogDto.repsUnit`) and labels the
reps field with it; record chips are off for carries.


## 2026-11 — Core day on one screen (v0.446.0 / web 0.639.0)

`WorkoutBlockDto.core` marks a Core day; the day page draws it as one
`CoreDayCard`, which opens `Route.CoreWorkout` → `CoreWorkoutScreen`
(MovementSetsScreen.kt). The screen holds one `MovementSetsViewModel` per
movement, keyed exactly as each movement's own page, and draws a
`CoreMoveSection` each (name, ⓘ, Skip, today's target, set cards, Add set,
Timer for holds, how it felt). One Log calls every `leave()` and goes back
once all are done. The moves travel in the route as `encodeCoreMoves`
(tab/line separated). "Strength" comes from the server's labels.


## 2026-11 — Progress focus and the warm-up chooser (v0.445.0 / web 0.638.0)

`WorkoutChart` opens on `focusGroups(planDays, today)`: today's groups, else
the next planned day's, never the last one trained. Groups with no weight
charts (Core of holds and reps) get their region when planned or trained
(`summaryGroups`) and a `HeatGroupSummary` block (12-week hard sets a week
and bests, from `heat`). `HeatBests` is shared with the heat pop-up.
Add workout → Warm-up shows `WarmupChooser` (WarmupScreens.kt) — the Core
rotation's layout, single choice — and sends `AddPoolRequest.warmup`; the
plan line's Warm-up screen uses the same chooser. The home card's lines are
the server's.


## 2026-11 — 0.444.1: CoreActions is public

`AddWorkoutSheet` is public and takes a `CoreActions`, so the interface can't
be internal ("public function exposes its internal parameter type").


## 2026-11 — Core days (v0.444.0 / web 0.637.0)

Add workout → Weights → Core offers Core rotation / Pick movements
(`CoreModeSwitch`); the rotation picker (`CoreRotationPicker`, CoreDays.kt)
numbers workouts in tap order, ⓘ lists a workout's movements, and "New core
workout" / the pencil open `CoreWorkoutEditor` (movement, Reps / Hold /
Weight, sets × min–max). A Core day's plan line (`CorePlanLine`) shows the
workout planned now and a Rotation button (`CoreRotationDialog`). Writes go
through `EditPlanViewModel` (`setCoreDay`, `saveCoreWorkout`,
`deleteCoreWorkout`, handed to the screens as `CoreActions`); the options
reload after a save so the new workout shows. The server picks the workout
due and writes its movements, so the day page and logger need nothing new
except hold targets: `TargetSetDto.seconds` fills the time hint. Older
servers send no `coreWorkouts`, and the switch doesn't show.


## 2026-11 — Core days and the two-row legend (v0.443.0 / web 0.636.0)

`ProgressSummaryCards` takes `heat.days` (`HeatDayDto`): a day a group was
trained without weights gets that group's square, so a core day of planks
shows in amber like any lifting day. The legend is four to a row in equal
columns (`chunked(4)`), so a seventh group starts a lined-up second row. The
heat pop-up shows holds as m:ss with a plank's PFT points (`HeatBestDto.pft`).
The counting is the server's (web DECISIONS, v0.636).


## 2026-11 — Body-map heat view (v0.442.0 / web 0.635.0)

`WorkoutChart` takes the progress payload's `heat` (`HeatMapDto`). A flame
toggle (`HeatToggle`, top-left of the map) swaps the primary/secondary view
for hard sets a week per muscle; range chips 1 wk / 4 wk / 12 wk (default) /
6 mo / All. Both kept in `SettingsStore` (`heatOn`, `heatRange`). One hue at
three strengths (`heatShade`, the theme primary blended toward the figure's
fade), a key with an ⓘ pop-up, and a tap opens `HeatDetailDialog` (sets a
week, heavy sets a week, bests then → now). The server does all the counting
(see the web's DECISIONS, v0.635), so the phone just draws it. Older servers
send no `heat`, and the flame doesn't show.


## 2026-11 — Progress is history, not the plan (v0.441.0 / web 0.634.0)

`WorkoutChart`'s universe was the plan's tracked movements whenever any were
tracked, so a muscle no longer programmed dropped off the body map, records
and Workout days. It's now every series with logged points; the plan still
picks what the map opens on.


## 2026-11 — Timer looks as they look; black floating window (v0.440.0 / web 0.632.0)

`TimerLookPicker` (TimerLive.kt) replaces the Numbers and Number colour
drop-downs in Appearance: each choice is "1:30" in its font and colour on a
dark tile. Colours are neon (`timerColorFor`; new PINK and ORANGE keys, old
keys kept). `PipTimer` draws on black: a picture-in-picture window is always
an opaque tile, so black is the least there can be behind the digits.


## 2026-11 — Leaving a lift early keeps the rest; build fix (v0.439.0 / web 0.631.0)

Mirrors web 0.631.0: `MovementSetsViewModel.rowsFrom` appends the target sets
after today's logged ones; `unfinishedCount()` and a "Finish early?" dialog on
Log. Build fix: `PipTimer` read `maxHeight` inside a `Column` (its scope hides
`BoxWithConstraintsScope`); it's read before the Column now.


## 2026-11 — The timer outside the app; number font and colour (v0.438.0 / web 0.630.0)

**Outside the app:** `TimerLive` (ui/workout/TimerLive.kt) holds what a
running timer shows; `ConditioningTimer` and `WarmupTimer` publish it when
their step, phase or get-ready changes (not every second) and clear it when
they finish or close.
- **Notification:** `TimerService`, a foreground service (type `specialUse`,
  silent `workout_timer` channel), posts it with a chronometer counting down
  to the step's end (`setChronometerCountDown`) or up for a stopwatch, so it
  ticks without the app; paused shows the time as text. On Android 16+ it asks
  to be a Live Update (`setRequestPromotedOngoing`, called by name so older
  SDKs skip it; `POST_PROMOTED_NOTIFICATIONS`), the status-bar chip. As a
  foreground service it also keeps the process running, so the beeps don't
  stop when the phone would otherwise freeze the app in the background.
- **Floating window:** picture-in-picture. `MainActivity` sets auto-enter
  (Android 12+) while a timer runs, or enters on `onUserLeaveHint` before
  that, at 16:9; `TimerLive.inPip` makes the timer draw only `PipTimer` (the
  time sized to the window, a word of status). A floating window can't be
  see-through: Android draws it as a solid tile, so it's the digits on the
  timer's background. The activity now handles size and orientation changes
  itself (`configChanges`), so entering the window doesn't restart it and
  lose the timer.
- `SettingsStore.timerAway`: BOTH (default), NOTIFY, FLOAT or OFF.

**Numbers:** `timerFont` (Standard, Condensed, Monospace, Serif) and
`timerColor` (Plain, Theme colour, Amber, Green, Red, Blue), under Settings →
Appearance → Workout timer; get-ready and rest keep their colours.


## 2026-11 — Warm-up check; first side (v0.437.0 / web 0.629.0)

`WarmupCard` (CardioBlock.kt): Mark done is a 40 dp hollow accent check circle,
filled when done; the card opens `WarmupWindow`. `WarmupTimer`: "Start on"
Left / Right when the run has an each-side step (`warmup_right_first` in the
timer prefs); `warmupIntervals(…, rightFirst)`; `ChipRow` takes a label and
width. Push-ups and the like ask for reps only once the server sends REPS
(web 0.629); the set logger already handled REPS.


## 2026-11 — Thinner outlines; one-row Cardio card; home workout card (v0.436.0 / web 0.628.0)

`AccentOutlinedButton` and the set logger's / Swap pills use a 1 dp outline
(2 dp read as heavy). `CardioBlock` with nothing logged is one row like the
Warm-up card: the title with "Check Concept2" under it, then Skip and Add.
`WorkoutSummaryCard` shows each workout task's `subtitle` (server 0.628+) under
the title in the Chores card's second-line style, and is at least 64 dp tall.


## 2026-11 — One button style; Recent workouts by day (v0.435.0 / web 0.627.0)

Mirrors web 0.627.0. Plain `OutlinedButton`s in the workout screens are
`AccentOutlinedButton` (timers, Delete and Stop rotation excepted); the set
logger's pills (Add set, Same as last time) and the Swap pills have the 2 dp
accent outline. `WarmupTimer`'s pauses are 0/1/2/3/5/10 s. `DayHeader` takes
`planned`: no "logging late" on a day with nothing planned.
`WorkoutHistoryDto.ids`: an entry is a day, and `RecentWorkoutsViewModel.delete`
deletes each of its sessions. Titles and the past day's program come from the
server.


## 2026-11 — ⓘ on picks; next cycle with changes; a banner that clears (v0.434.0 / web 0.626.0)

Mirrors web 0.626.0: `ProgramOptionDto.about` and `PlanMovementDto.about`;
`PickedInfo` (ⓘ + `MovementInfoDialog`) beside main and companion picks in
`ProgramSetup`; ⓘ on the plan editor's movement rows; the Log an additional
workout exercise list opens the how-to under a row. `CycleEndDialog` adds
"Next cycle, with changes" (when `ProgramsDto.setup` is the running program):
`ProgramSetup(initial, nextMaxes)` opens on the plan as it is, the Maxes step
edits the raised training maxes, and it starts with `next = true`. "Save,
share or export" uses `AccentOutlinedButton`.

**"Kairos server unavailable" while it wasn't:** the flag is set by a 502/503/504
(or a write that never reached the server) and cleared only by the next live
success, so a screen that had finished loading kept the banner up after one
bad answer. `SyncManager` now asks `meta` every 15 s while the flag is up and
clears it on a 2xx. Setting and clearing it drop a breadcrumb with the method,
path and status (no query or body), so Diagnostics shows what set it.


## 2026-11 — Visible buttons; Conditioning in its place; warm-up countdown (v0.433.0 / web 0.625.0)

Mirrors web 0.625.0.
- `ui/common/AccentOutlinedButton`: a 2 dp primary outline and primary text
  on the surface colour. Used for Rest / skip day, + Conditioning and Log an
  additional workout; a plain OutlinedButton's grey outline read as disabled.
- `WorkoutLogScreen`: CONDITIONING is always among the day's section kinds,
  so its section (empty or not) sits where the person's order puts it, and
  the one-off conditioning list and + Conditioning render inside it.
- Day header: the server's `title` is the program's name on a program day,
  else the kinds of work; `programLine` is just the week label.
  `LoggedOtherDto.label` (a game's event type) titles a past day.
- `WarmupTimer.kt`: `warmupIntervals` / `warmupSchedule` / `warmupAt` mirror
  warmup-library.ts. A timed step's Timer runs that step and the timed steps
  straight after it (an each-side step twice), get-ready before the first
  (`TIMER_LEADS`), a chosen pause between (`WARMUP_GAPS`), tones on the alarm
  stream and a buzz at each change, Pause and Skip; the steps it ran are
  ticked. Colours from `timerPalette()` (now internal). Replaces the
  count-up StepTimer.
- `RoutineRow` has a surface background.


## 2026-11 — Companion exercises; Warm-ups screen; plan tools; rotation (v0.432.0 / web 0.624.0)

Mirrors web 0.624.0. `ProgramsScreen`: Lifts in weekday order, "Companion
exercises", "+ Add exercise", a library option shown "· new"
(`ProgramOptionDto.add`), "Training max 120" with an ⓘ AlertDialog, and a
Rotation card under Programs (`onOpenRotation` → `Route.Rotation`).
`WarmupsScreen` (`Route.Warmups`) from the Workouts page's Warm-ups card,
which replaces Rest / skip; "HIIT / CrossFit" with "Create / edit" under it.
`WorkoutLogScreen`: "Rest / skip day" until something is logged or the day is
rested (`rested`, server 0.624+). `EditPlanScreen`: no Rotation action; the
plan's tools are one "Save, share or export" button at the foot opening a
sheet (Save to My plans, Share with the household, Export, Import;
`KairosIcons.Upload` added).

## 2026-11 — Grouped sets; past days; sync that doesn't stick (v0.431.0 / web 0.623.0)

**Grouped sets and past days:** mirrors web 0.623.0 — `MovementSetsScreen`
heads Warm-up / Main sets / "5 × 10" and numbers each from 1
(`SetRow.supplemental`); `WorkoutLogScreen` lists `loggedOther` under
"Logged", titles a day with nothing planned by what was logged, and drops
"logging late" when `loggedAny`.

**"Waiting to sync" that never cleared:**
- Opening Workouts POSTs the Concept2 check. When the phone briefly reported
  no network (right after the app returns from the background the system can
  answer "no active network" for a moment), the write interceptor queued it,
  so "1 change waiting to sync" appeared with nothing changed. `concept2/sync`
  (and any request with `X-Kairos-No-Queue`) is never queued now.
- `NetworkMonitor.isOnline()` is the fresh read OR the callback-tracked state,
  so that moment no longer counts as offline.
- The retry loop could die on an unexpected (non-IO) error and never run
  again until restart; passes now go through `safeReplay`, the retry runs every
  15 s while something waits, and the app replays on every resume.

**Stall watchdog:** the "MAIN THREAD STALLED 600–1000 s at nativePollOnce"
breadcrumbs were the app being frozen in the background (the watchdog thread
slept through it too). When its own sleep overruns, it now starts over instead
of reporting.

## 2026-11 — Warm-up routines; timer look (v0.430.0 / web 0.622.0)

Mirrors web 0.622.0. `WarmupScreens.kt`: `WarmupWindow` (steps, a tick each,
`StepTimer` count-up on timed ones, Switch, Mark done), `RoutinePicker`,
`RoutineEditor` (a ready-made one saves your own copy) and `WarmupPlanLine`
(the plan editor's Warm-up entry), all full-screen Dialogs with a back arrow.
`WarmupCard`: tapping the name opens the window; the check still completes it.
`SimplePlanDto.routine`, `PlanWorkoutDto.warmup`, `ProgramsDto.warmups`,
`CurrentExtrasDto.warmupRoutine`, `StartProgramRequest.warmupRoutine`; new
calls `workouts/warmups` (GET, POST), `warmups/delete`, `plan/warmup`. The
setup's Extras Warm-up is a `Dropdown` (None / Just a check / routines).
`ConditioningTimer` takes a `TimerPalette` from `SettingsStore.timerTheme`
(DARK default, LIGHT, APP); Settings → Appearance → Workout timer.

## 2026-11 — Warm-up sets; setup labels and maxes; group order; Add workout full screen (v0.429.0 / web 0.621.0)

Mirrors web 0.621.0. `SetRow.warmup` shows "W" and the working sets number
from 1. `ProgramsScreen`: white (`containerColor = surface`); companion rows
show their type label above and "Time" for a timed option
(`ProgramOptionDto.timed`); the last step is Maxes (best pre-filled, TM under
it, the TM sent). `WorkoutChart`: today's groups first in the plan's
order, then A–Z; each `LiftBlock` names its movement. `CardioBlock`: the title
keeps one line; Skip / Add cardio sit on their own row when nothing is logged.
`AddWorkoutSheet` is a full-screen Dialog with a back arrow and the Add button
pinned at the bottom, not a ModalBottomSheet (dragging the list closed it).

## 2026-11 — Program setup steps; My plans; end of cycle; + sets (v0.428.0 / web 0.620.0)

Mirrors web 0.620.0 (see its DECISIONS for the programs). `ProgramsScreen`:
the chooser has Programs / My plans / Household tabs (`PlanLibrary`: list,
preview in an AlertDialog with Replace / Add, and for My plans Save, Rename
and Delete); a program is set up in four steps (Days, Lifts, Extras, Training
maxes) with Back / Next pinned at the bottom; pickers are `Dropdown` (the
full-screen `OptionPickerOverlay`). Starting navigates to Edit plan. The
end-of-cycle AlertDialog opens on its own when the cycle is done: a raise per
lift (from `TrainingMaxDto.step`), Next cycle, Repeat, Switch program. A
target set's `plus` shows the reps hint as "5+". New calls:
`workouts/plan/saved` (GET, POST), `saved/rename`, `saved/delete`;
`StartProgramRequest` and `NextBlockRequest` gain optional fields (omitted
when null, so an older server ignores them).

## 2026-11 — Deadlift group; 5/3/1 logger; timer; + Conditioning (v0.427.0 / web 0.619.0)

Mirrors web 0.619.0. Deadlift is a muscle group (colour 0xFF9C6B3C); the body
map's posterior-hip paths take the Deadlift fill. A target set with `pct` is a
5/3/1 set: the set column shows the % (34 dp wide) instead of TOP, × becomes a
plates button that opens the weight calculator with `startTotal` (switching the
bar reloads the plates via `platesFor`), and Remaining sets is hidden. A
DURATION movement's tile is Timer, which opens `ConditioningTimer` (for time);
its result fills the next set's seconds. + Conditioning on the day opens an
AlertDialog (Pick one / Build one / Write your own) reusing the conditioning
sheet; what's logged lists as extras. Change program is a button on the
Workouts program card (`Routes.ProgramsChange` opens Programs already
picking). Program setup pre-fills Top weight from the option's `best`. The
Workout days chart rows are plan days plus weekdays logged in the last 16
weeks.

## 2026-10 — Effort slider; one Cardio card (v0.426.1 / web 0.618.1)

`EffortChooser` (MovementSetsScreen.kt) is a Material Slider (4 stops, thumb
and active track in the primary colour, grey until answered) with a check
(OutlinedIconButton → FilledIconButton once saved) and a bandage IconButton
opening the hurt areas in an AlertDialog. Every caller (sets, cardio,
conditioning, the home sport prompt) gets it unchanged. `CardioBlock` is one
OutlinedCard: title, ⟳ Concept2 (`KairosIcons.Sync`) and + on it; no trash on
a Concept2 row. New icons: `KairosIcons.Sync`, `KairosIcons.Bandage`.

## 2026-10 — Export, import and household plans on the phone (v0.426.0 / web 0.618.0)

The plan screen gets four buttons under "Starts on": Household plans, Share
this plan, Export and Import, each a ModalBottomSheet (`PlanFileSheets.kt`).
Export asks the server for the file as text (`ResponseBody`, so it's saved
exactly as sent) and writes it where the person picks with the system's
CreateDocument; Import reads a picked file (OpenDocument) and sends its text,
first for a preview, then with Replace (confirmed in a dialog) or Add.
Approving shared plans stays on the web's Admin.

## 2026-10 — Pick one, Build one, Rx/Scaled, monthly benchmark (v0.425.0 / web 0.617.0)

A "pick on the day" Conditioning plan comes in the day read's `picks` (it has
no movements, so it isn't in `workouts`) and adds the Conditioning section
like Warm-up and Cardio do. Its card opens Pick one or Build one as
ModalBottomSheets; tapping a workout shows it in the same sheet with Rx /
Scaled (ChoicePills), Start (the existing ConditioningTimer, fed a
ConditioningPlanDto) and Log a result. Write your own opens the personal
workout screen. Build one asks the server to build (`workouts/conditioning/
build`) rather than porting the generator, and sends the workout back as is
to log or save. Every conditioning result, planned ones included, now logs
through `workouts/conditioning/log` with the version, so the session is named
after the workout like the web's. The plan sheet's HIIT Workout list starts
with "Pick on the day" (an add-pool with category HIIT, no movements, name
Conditioning). The benchmark card sits under the suggestion card.

## 2026-10 — Pickers, Add cardio sheet, replace warning (v0.424.1 / web 0.616.1)

`ui/common/OptionPickerOverlay` is the calendar's full-screen radio list made
shared; the plan screen's `Dropdown`, Sets and Copy from use it instead of a
DropdownMenu. Add cardio is a ModalBottomSheet like Add workout. "Start again"
on a conditioning workout logged today asks before opening the timer, and the
timer's result step says it replaces today's result.

## 2026-10 — Conditioning timer on the phone (v0.424.0 / web 0.616.0)

`ConditioningTimer` is a full-screen dialog run by `Timer.kt` (the web's
timer.ts rules, mirrored; keep them in step). Time comes from
`SystemClock.elapsedRealtime`, checked four times a second, so it can't drift.
Tones play through `ToneGenerator` on the alarm stream so they're heard over
music; vibration needs the VIBRATE permission (added). The view's keepScreenOn
is set while the get-ready or the clock is running. Sound and get-ready length
are kept in SharedPreferences ("kairos_timer"). `ConditioningCard` replaces the
plain block for a planned named workout: last result, household best, Start,
Log a result, Skip, and "How did it feel?" once logged. The result goes through
the plan's log with replace (one per workout a day).

## 2026-10 — Cardio as one card (v0.423.1 / web 0.615.1)

With nothing logged yet, the day's Cardio is one card like the Warm-up: its
name, "Check Concept2 now" when connected, Skip and Add cardio. Once something
is logged, the entries show and Add cardio sits under them. Whether Warm-up and
Cardio make a day late is the server's call (they don't, from web 0.615.1).

## 2026-10 — Cardio, Warm-up, day order and set structure on the phone (v0.423.0 / web 0.615.0)

The day screen orders its sections by the server's `order` (mirrored
`sectionOrder` = the web's cleanOrder) and adds a Warm-up and a Cardio section
from `simple` plans and the day's `cardio`, since those plans hold no
movements. `CardioBlock` replaces Concept2Rows: the day's cardio with "How did
it feel?" (`EffortChooser`, shared with the set logger and the home sport
prompt), Add cardio, Skip for a Cardio plan with nothing logged, and "Check
Concept2 now". Cardio, warm-up and skips are online only (like Undo); the
reload after each keeps the progress bar right. The plan screen gets "Order of
the day", "Order" per day, and a Sets choice on each weights movement (when
adding it and later). After "Did you do it? Yes" on Home, "How hard was it?"
stays until answered or skipped.

## 2026-10 — Concept2 on the phone (v0.422.0 / web 0.614.0)

Settings → Concept2 connects with the Logbook token (sent once, never shown
again) or disconnects. The day screen asks the server to check Concept2 when a
day loads and every 15 minutes while the view model lives; the server decides
whether to actually go to Concept2 (at most every 5 minutes), so the phone
needs no timer of its own beyond that. "Check Concept2 now" forces it. Rows
show under Cardio when rowing is planned, else under Extra; new rows reload
the day so the Cardio block counts done. Undo is online only: it changes
sessions on the server, and an offline Undo would race the next sync.

## 2026-10 — How-to behind ⓘ (v0.421.0 / web 0.613.0)

The server sends each movement's how-to (`about`) with the pool, the plan
options and the set logger. ⓘ sits in the set logger's top bar (a dialog with
the how-to and "Watch how") and on every row of the Swap lists and the plan
builder's movement list (the how-to opens under the row, since a dialog over a
dialog reads badly). "Watch how" is a video search for the name, built on the
phone, so nothing stored can go stale. Older servers send no `about`: ⓘ still
shows, with just "Watch how".

## 2026-10 — Suggestions on the phone (v0.420.0 / web 0.612.0)

`SuggestionCard` (in MovementSetsScreen.kt, shared with the log page) shows the
server's card with its choices, the first filled. The set logger's "Use 190"
moves the top set's hint, "Swap" opens the picker, "See programs" opens
Programs; the log page's "Lighter today" / "Ease in" shows the lighter line at
once (the loggers' hints come back lighter from the server). Answers go through
`workouts/suggestion` (queued offline) and a queued answer keeps its card
hidden on reload. A set more than 10% over `recentTop` gets an amber note
(`jumpFor`). Home shows the program invite (its own `workouts/programs` read).
Needs web 0.612.0.

## 2026-10 — Programs on the phone (v0.419.0 / web 0.611.0)

`ProgramsScreen` (Route.Programs, from a card on the Workouts page) shows the
running program (week, training maxes with Save, Raise my maxes / Repeat once a
block is done, Change program, End program with "Go back to my old plan" or
"Keep this plan"), or the program list and its setup: weekday circles, a
dropdown per slot (`Dropdown`, now shared from AddWorkoutSheet), and recent top
weights for main lifts. Coming back bumps `programsChanged` on the Workouts
entry so it reloads the plan. The Workouts page card is the running program,
the invite (Not now / Don't ask again), or a plain "Programs" row.

The set logger uses `workouts/sets` `target` for its hints and row count, marks
the top set, and shows "Today <scheme> · <program · week>". The log page header
shows the program line; charts draw `intent` points hollow. Needs web 0.611.0.

## 2026-10 — Records, how it felt, rep ranges, weekly training (v0.418.0 / web 0.610.0)

The set logger shows the record chips from `workouts/sets` `records` under the
top bar (the mockup's header chips) and "New best for N reps" on a saved set,
with the web's rules mirrored in `MovementSetsViewModel` (`recordChips`,
`isNewBest`: records.ts). Once a set is saved, a card asks how it felt and
whether something hurt; answers go to `workouts/feedback` (queued offline like
other writes, the whole answer each time) and a queued answer is re-applied on
reload. "Additional charts" gains the rep-range pills (`bands`), and a tapped
point shows its reps. The Workouts page gains the Weekly training card
(`workouts/weekly`, cached like Progress). Needs web 0.610.0.

## 2026-10 — Set logger: the mockup's top, and a fix for Remaining sets (v0.417.0)

0.416.0 put "Log workout" in the top bar and the movement's name in the page.
The name is the top bar's title again (the mockup), with "Last: Oct 23" (or
the save status, or "instead of …" after a swap) under it and Swap / Undo as
the top bar's action, since a swap changes what the title says. The "[165] lb ×
[3]" rows stay, with the boxes filling the row as in the mockup.

Remaining sets −/+ never visibly did anything: `SetCard` read the shift
through the view model (`vm.hintW(row)` with a default argument), and Compose
skipped the cards because none of their parameters changed. The shift is now
a parameter, so the grey weights move with it; the middle reads "+5 lb".

## 2026-10 — Web fonts in the app; set logger back to the card's style (v0.416.0)

The app used Material's default type (Roboto, regular weight), which read thin
next to the web and the mockups. `KairosTypography` now uses the web's fonts
(the same files, converted with fontTools; the variable Bricolage is
instantiated at 600 and 700 because Compose static fonts are simpler and
minSdk 26 gains nothing from the variable file). Glyphs they lack fall back to
the system font.

0.415.0's set logger drifted from the Log workout card: a column-heading row,
stretched boxes, and a bottom bar under the gesture bar. It now keeps the
mockup's layout in the card's own idiom: the movement names itself with the
Swap pill beside it (Undo when swapped) and "Last: Oct 23" on the right; each
set is a small card reading "[165] lb × [3]" with the card's 72dp boxes; Add set
and Same as last time are pills; −/+ are white circles; Skip / Calculator / Log
sit above the navigation bar (`navigationBarsPadding`), Log filled. The day page
is unchanged.

## 2026-10 — Day page and set logger follow the mockup (v0.415.0 / web 0.609.0)

0.414.0 bolted the new rows onto the old card layout. The log page now follows
the mockup and the web day page, built from the app's own parts (OutlinedCard,
WorkoutActionTile, the swap pill): a header card (the day, tap to pick another;
the title; "N of M done"; the week strip), then sections in the web's order
(`daySections` mirrored in `WorkoutLogScreen.kt`: warm-up, cardio, strength by
muscle group, conditioning, sport). A set-by-set movement is its own card with
today's sets or last time's and a Logged / Skipped chip; other plans keep their
existing card. Overdue days use the same sections, tinted and labelled with the
day. The set logger: a column header, a card per set (✓ fills when saved, "Last
time …" or "Added today" under it), Add set and Same as last time as pills,
Remaining sets with −/+, and Skip / Calculator / Log pinned to the bottom.

Adding a movement to a plan preselects the movement's own "Logs as" (server
0.609 `metric` on plan options), so a plank starts as time.

## 2026-10 — Every-set logging on the phone (v0.414.0 / web 0.608.0)

The log page uses the web's day-page rule (blocks.ts `daySections`): a strength
plan (WEIGHTS, ISOMETRIC or no category) whose tracked movements are all
WEIGHT, REPS or DURATION shows one row per movement that opens
`MovementSetsScreen`; everything else keeps its card. The set logger mirrors the
web: hints never become values until ✓; each save sends the movement's whole
saved list to `POST workouts/sets` (a replace, so a queued offline copy is safe to
replay); saves are sent one at a time with the newest rows; Back and Log keep
typed-but-unticked sets; a late day sends `completedOn`. A queued save is
re-applied on reload (the set screen's rows, the log page's set count). The week
strip mirrors `stripState`. Needs web 0.608.0 (older servers have no
`workouts/sets`).

## 2026-10 — Paper plates picture redrawn (v0.413.1 / web 0.605.1)

`grocery_paper_plates.png` replaced with the web's redrawn picture (same
160x134 size); the old one was cut off at the bottom. See the web's DECISIONS.

## 2026-10 — Change your password (v0.413.0 / web 0.605.0)

Settings → Password posts `{ current, next }` to `/api/v1/auth/password`; the
server checks everything and returns a message to show. Under `auth/` so the
offline queue never stores it (ApiClient skips `/auth/`); offline, the change
simply fails with "Couldn't reach the server". This phone stays signed in.

## 2026-10 — Drawer hides sections the server says to (v0.412.0 / web 0.604.0)

`GET /api/v1/nav` returns section keys to hide (the web sidebar's rule,
`hiddenNavFor`). Stored in DataStore (`nav_hidden`) so the drawer is right
offline and on a cold start; re-fetched on start, after a sync and whenever the
drawer is opened from the menu button. Empty until the first answer, so nothing
is hidden by guesswork; an older server (404) leaves everything shown.
Supersedes "the section is always in the drawer" from 0.409.

## 2026-10 — Scoring rework on the phone (v0.411.0 / web 0.603.0)

The rules live on the server (web docs/SCORING.md); the phone draws what it is
sent. Character card: squares from `pendingFrom` on are today's growth (alpha
0.45), `growthLabel` ("7.4 / 12") under the row while growing and beside the
deepening rail; "This month" shows `month.credit / month.target` days (falls back
to the season tier when an older server omits `month`). Family goal rows show
`credit` (one decimal, rounded down, `fmtDays`). Settings → How scoring works
draws `GET /api/v1/scoring/guide` (the same text as the web's /scoring page) and
caches it in the Room page cache so it opens offline.

## 2026-10 — Hockey layout per person (v0.410.0 / web 0.601.0)

Sections arrive from `/api/v1/hockey` already in the person's order with
`open` set (the server's `arrangeSections`); the app draws them and changes
them in place. A toggle or an Arrange move updates the screen at once, rewrites
the Room page cache (so the layout holds offline and on the next cold open),
and posts the whole layout to `/api/v1/hockey/prefs`. Offline, that post is
queued by the normal write queue and replayed — safe because it is the whole
layout, not a delta. Collapsed sections show their session count; the
explanatory footer was removed.

## 2026-10 — Hockey section (v0.409.0 / web 0.600.0)

`GET /api/v1/hockey` returns the week already shaped by the server's
`buildHockeyView` (event name, button label, saved location, the "Hockey
practice" type id), so `ui/hockey/HockeyScreen.kt` only draws it — no rule is
copied onto the phone. Empty days are left out (the web lists all seven). Add
hands an `IcsDraft` plus the type id to the Calendar through
`CalendarOpen.NewFromDraft`, the same pending-open path the widget uses, so the
normal New event form opens filled in, owned by the person on this phone, with
participants addable. `AddEventOverlay` takes `presetEventTypeId`, applied only
on a new event and only if the type still exists. The section is always in the
drawer; on a server without ice-time it says Hockey isn't set up (the web hides
it — the app has no feature flag from the server yet). The last good week is
cached and stays on screen if ice-time can't be reached.

## 2026-10 — Grocery icon batch 2 (v0.408.0 / web 0.598.0)

16 more `grocery_*` PNGs (same files as the web), mapped in `KAIROS_DRAWABLES`
and added to `GROCERY_SUGGESTIONS`. `kairos:deodorant` (blue) is now listed as
"Women's deodorant"; the new `kairos:mens-deodorant` is "Men's deodorant".
Details in the web repo's DECISIONS for 0.598.0.

## 2026-10 — Emoji grocery icons get the dark-mode tile too (v0.407.1 / web 0.596.1)

0.596.0 tiled only the pictures, so a dark list mixed tiled pictures with
bare emoji (apples, bread, anything typed in). Emoji now get the same tile.
Web: `GroceryGlyph` wraps the emoji in a box of the picture's size
(`.grocery-emoji-tile`), `display: contents` in light mode so light layout is
byte-for-byte what it was, an inline-flex tile in dark mode with the emoji
sized by container units (66cqh). App: the emoji branch draws the same tile
when dark, with the emoji's size derived from the tile through the density.

## 2026-10 — Grocery icons on a light tile in dark mode (v0.407.0 / web 0.596.0)

An audit of all 310 grocery pictures on a dark page found ~100 with a pale
edge or soft grey drop shadow left from their original white backgrounds —
invisible on white, obvious on dark. Rather than repair each one (and every
future batch), every grocery *picture* now sits on a soft light tile in dark
mode: the light page's ground colour (#e8edf3), 24% rounded corners, 2px
inset. Web: `.grocery-pic` on `GroceryGlyph`'s <img>, styled under
`html.dark` in globals.css. App: `GroceryGlyph` draws the same tile when
`KairosThemeState.dark`. Light mode and emoji icons are unchanged.

The 12 store icons lost their leftover white card and thin grey frame
(frame stripped from the outer 4px; the card flooded away on the four that
still had one; stray line pieces removed). `feminine-care` is gone: PNG,
matcher rule, picker entry, suggestion and app map entry. Still to
regenerate: `air-freshener` (part of its white can was erased with the
background) and the legacy `ic:sorbet` square.

## 2026-10 — Grocery icon batch (v0.406.0 / web 0.595.0)

49 new `grocery_*` PNGs, the same files as the web's
`public/grocery-icons/kairos/`, mapped in `KAIROS_DRAWABLES` and added to
`GROCERY_SUGGESTIONS` (kept identical to the web list). How they were cut
and made dark-mode safe is in the web repo's DECISIONS for 0.595.0.

## 2026-10 — Body map light-mode grey (v0.405.1 / web 0.594.1)

The near-black light-mode figure from 0.594.0 was too heavy. Light mode now
uses a mid grey (#b4c1cf) with white seams, pastel assisting muscles (fade
toward white) and a dark selection ring; dark mode keeps the light figure.

## 2026-10 — Dark-mode fixes, body map figure, Shopping (v0.405.0 / web 0.594.0)

Screens that hard-coded light colours now follow the theme: Add an item and
the startup screen use `colorScheme.background` (they were `Color.White`);
the money banners (Money page, home reminder) and the overdue workout card
pick dark tinted colours when `KairosThemeState.dark`. The body map's
figure is swapped against the page by `figureColors(dark)` — dark figure on
light cards, light on dark — matching the web's `--color-figure*` vars.
`grocery_paper_plates` gets its plate face back (it had been cut out with
the sheet's white card) and `grocery_ground_sausage`, which was blank, is
the ground-meat tray recoloured. The section is labelled Shopping; the route
and code keep "groceries".

## 2026-10 — Widget header icons: grey, lighter lines (v0.404.1)

The + now uses the same muted color as refresh, and both header icons draw
with 1.5 strokes (in a 24 viewport) instead of 2. Scaling the icons up to
28/32dp had scaled the lines with them (about 2.7dp on the +), which read as
bold; at 1.5 they land near the old icons' line weight while staying large.

## 2026-10 — Widget header buttons without circles (v0.404.0)

The + and refresh buttons drop their filled circles and are drawn as bare,
larger icons (`HeaderButton`, replacing `RoundButton`): + at 32dp in the
theme color, refresh at 28dp in the muted text color so it sits quietly in
the card (28/24dp on tiny widgets). The tap area stays 40dp (34dp tiny), with
a rounded corner kept only to shape the press ripple. The picker preview
matches, and loses the today circle the widget itself dropped in 0.402.0.

## 2026-10 — Anniversary type (v0.403.0 / web 0.591.0)

Anniversary joins the type list and the reminder-defaults list (no reminder by
default, like Birthday), forces all-day + yearly like Birthday
(`isOccasionKind`, mirroring the web's `isOccasion`), and has its own color slot
under Custom colors. The name picker already comes filtered from the server.

## 2026-10 — No today circle on the widget; repeating events have one end (v0.402.0 / web 0.590.0)

- The widget's day labels are all drawn alike — the date is already in its
  header. The number box keeps a clear background (reused list rows).
- New repeating events: the end date beside Starts is hidden (all-day) or
  reduced to an end time, "Ends the next day" when it runs past midnight, and
  kept in step with the start. The server applies the same rule on every save
  (`fitRepeatingSpan`, web DECISIONS), which also covers editing a series here,
  where the repeat can't be changed.
- The "all-day events also showing the day before" fix is server-side
  (web 0.590.0); nothing in the app computes those days itself.

## 2026-10 — Widget Solid / Accent styles (v0.401.0; renamed from Quiet in 0.401.1)

The second style ("Accent"; briefly "Quiet") is no longer "like Home": the names on each line made it
unreadable at widget size. Accent keeps Solid's content (title, time, place)
beside a color bar, and outlines tasks in the theme color instead of filling
them. Tasks draw the same views in both styles (an accent box with an inner box
inset 1.5dp, since Glance has no border) so reused list rows stay right. The
month is always written in full, in a normal weight, with the day number bold;
narrow widgets shrink the font rather than abbreviate. Appearance lost its
explanatory lines and its labels were shortened (Solid / Accent, App / System /
Light / Dark), at the owner's request.

## 2026-10 — Birthday in Profile; a date picker with month and year quick picks (v0.400.0 / web 0.589.0)

Profile gains a Birthday card (`GET`/`POST /api/v1/me/birthday`), saved the
moment a date is picked or cleared. The server applies the same rule as the web
form (`checkBirthday`: a real date, 1900 on, not in the future) and its message
is shown as-is. The picker is `ui/common/QuickDatePicker.kt`: the app's own
pop-up (AnimatedDialog), a Sunday-first month like the calendar, with the month
and year in the header as buttons — the year opens a year grid, then the month
grid, then the days. Material's DatePicker offers only a year list, and paging
back decades month by month is what a birthday needs least. The other date
pickers in the app are unchanged; this one is in `ui/common` so they can move
to it.

## 2026-10 — Widget fixes after first use (v0.399.0 / web 0.588.1)

- **Stray circles** around Thursday and Saturday, with dark text: the launcher
  reuses list rows, and the day label only set the circle's background on
  today's row, so a reused row kept it. Every row now draws the same views and
  sets the background either way (transparent when not today). The same rule
  now holds for the "who" text on the color-bar style.
- **Multi-day all-day events** are listed once, on their first day in view,
  with "through <day>" (server drops the repeats; widget only).
- **Narrow widgets**: `SizeMode.Exact`; under 280dp the header says "Oct 19" at
  20sp, under 220dp 18sp with smaller buttons.
- **Tasks** are 30dp lines with 13sp text, shorter than an event.
- **Widget light/dark** is its own setting (Like app / System / Light / Dark),
  so the app can stay light while the widget follows the phone.
- **Picker preview**: a static sample week (`previewLayout`), made-up events.

## 2026-10 — Home-screen widget; theme follows the phone (v0.398.0 / web 0.588.0)

A calendar + tasks widget, designed on a mockup first. Decided with the owner:
- **Glance**, not hand-built RemoteViews: one Compose-style file, and the
  colours come from the app's own palette (`widgetPalette`).
- **Events colored by the server**: `/api/v1/widget` runs the Calendar's own
  filter and recolor (`personalEventRules`), so "others grey" under Custom
  colors applies to the widget unchanged.
- **Whole family by default**, a per-phone "Only mine" setting. Tasks are always
  the phone owner's own, because the widget can tick them off.
- **Event style is a per-phone setting**: solid boxes (default) or the home
  page's color bar with who it's for.
- **The task's icon is its checkbox**: an empty rounded square, ticked when
  done. The rest of the task opens Tasks with that task tinted for a few seconds.
- **No "no due date" line**: a task always has a due date (blank = today). The
  top line counts overdue tasks instead and opens Tasks.
- **+ opens a chooser**: Android widgets can't show a popup, so + starts a
  see-through activity drawn as a dialog (New task / New event), which opens
  the app on Assign a task or New event.
- **7 days**, empty days left out.
- **Theme mode System / Light / Dark** replaces the dark-mode switch; System is
  the default for anyone who never touched the switch, and the widget follows
  the app's setting.

Built without an Android build here: the widget files were compiled with
`kotlinc` against stubs of the Glance API (Kotlin-level errors only); the first
real build is the check that the Glance calls match the library.

## 2026-10 — Reps on a one-off weights log (v0.397.0 / web 0.587.0)

The "log a different workout" wizard took a weight only. Its value step now
shows a reps box beside the weight when the metric is WEIGHT (`showReps`), and
`CustomLogRequest` gains `reps: Int? = null`, appended last. Optional; blank
logs exactly as before. Reset with the rest of the form when the type changes.

## 2026-10 — Skip is saved per movement; reps refill (v0.396.0 / web 0.586.0)

Skip on a movement was local only: it greyed the row and left it out of the
log, but nothing reached the server, so it vanished on reload and could not
count toward the day. It now calls `POST /api/v1/workouts/skip` (optimistic,
rolled back on failure). A swapped row skips under the planned movement's id;
a one-result block (HIIT) sends `""`. Overdue blocks skip the same way — they
used to rest the whole day from any one movement's tile. Skipping no longer
blanks a typed value. The server decides whether the day is complete (every
movement logged or skipped — web DECISIONS, v0.586); the tick beside a plan's
name follows the same rule locally, ignoring untracked movements.

Reps did not refill because the server never sent them; `PlannedMovementDto`
gains `reps`, `skipped` and `tracked`, appended with defaults. A movement's Log
with an empty box no longer sends anything (an empty log used to clear every
movement already logged on the plan). The reps placeholder says "reps".

## 2026-10 — Character page reloads after a gallery swap (v0.395.0 / web 0.585.0)

`CharacterViewModel` loads once (cache first, then the server) and survives the
trip to the gallery, so after "Make this my companion" it went on showing the
companion it loaded before — the web and the gallery, which ask the server
fresh, showed the new one. `CollectionViewModel` now takes an
`onCompanionChanged` callback; the gallery bumps `AppContainer.companionRevision`
after a successful swap, and `CharacterScreen` reloads when it changes (a
shared signal rather than ON_RESUME, which is unreliable under the drawer nav).
The reset-to-hatchling half of the report was server-side: web DECISIONS,
"A companion brought back keeps its stage".

## 2026-10 — "Your turn" on the home card (v0.394.0 / web 0.584.0)

The home Chores card now pulls any up-for-grabs chore with `furthestBehind`
out of the grey summary line into its own row: the same red "!" the Chores
detail uses, "Your turn: <chore>", and "You did it longest ago". Who that is
stays the server's call — including the admin's Turn reminder opt-outs (web
DECISIONS, v0.584) — so the app adds no rule of its own. Always-open chores
off your "Available for" list no longer reach the phone at all (server-side).

## 2026-10 — Family-goal votes: one a month, and the card is the server's call (v0.393.0 / web 0.583.0)

Rationale in the web DECISIONS ("One family-goal vote a month"). App side: the
home card no longer decides for itself whether to nudge — it shows for a goal
(carried, chosen or earned) or when the server's `homeNudge` is "vote" / "pick",
so the rule lives once (web `coopHomeNudge`). An older server omits the field
and the nudge simply doesn't show. On the Family goal screen the button reads
"Move my vote here" when your vote is on another idea; the server does the move.

## 2026-10 — Companion as profile picture, chosen in the gallery (v0.392.0 / web 0.582.0)

Full rationale in the web repo's DECISIONS ("A companion can be the profile
picture"). App side: the gallery's enlarge dialog gains "Use as profile
picture" (only when the server sends `stageImages`), which opens a three-stage
picker — reached stages show their art and are tappable, unreached show an egg
and "Not yet" (their art is never sent), and the picture in use is ringed. The
pick posts `/me/avatar/companion`, and `SessionRepository.setCompanionAvatar`
adopts the returned person, so the rail and every avatar update at once.

The result shows in its own `pictureNotice`. The view model's older `message`
(set after "Make this my companion") has never been displayed by the gallery;
surfacing it here would have changed that flow unasked, so it is left alone.

All three avatar views (rail, `PersonAvatar`, Profile preview) draw a companion
through one composable, `CompanionAvatarArt`: fit, not crop, no framing.

## 2026-10 — Hand-offs go to the activity on screen (v0.391.0)

An `.ics` opened from Gmail landed on Home with nothing imported. The log showed
two MainActivity instances: the mail app's "Open with" starts a fresh one, while
an older, stopped one lingered. Both compositions collect the app-wide one-shot
flows in AppContainer (`pendingRoute`, `pendingIcs`), and a stopped activity's
composition still runs — so the hidden one, not stuck behind the new one's 2 s
splash, consumed both: it navigated itself to Calendar and opened the filled-in
form where nobody could see it. The new one then finished its splash on Home.

Fix: `rememberActivityOnScreen()` (ui/common) — the hosting ACTIVITY is at least
STARTED — gates the `pendingRoute` effect in AppRoot and the `pendingIcs` effect
in CalendarScreen. It deliberately reads the activity's lifecycle, not the
NavBackStackEntry's, because drawer navigation can leave an entry below RESUMED
while its screen shows. The same race could send a notification tap to the
hidden instance, so that is fixed too. Any new hand-off through AppContainer
must be consumed behind the same gate.

Considered and not done: `launchMode="singleTask"` would avoid the second
instance, but changes how Back and recents behave across the app for a problem
the gate already solves.

## 2026-10 — Launcher icon inset is a fraction, not dp (v0.390.0)

The adaptive icon's foreground wrapped the logo in `<inset android:inset="20dp">`.
A dp inset doesn't scale with the size the icon is drawn at: on the home screen
(large) 20dp per side is a normal margin, but the system "Open with" sheet draws
the icon small and the same 20dp per side left almost nothing for the logo — a
speck in a white circle. Now `18.5%` (20/108 of the adaptive canvas): identical
on the launcher, proportional everywhere else. Any future inset or padding in an
icon layer should be a percentage for the same reason.

## 2026-10 — Release notes are short, for the household (v0.390.0)

`CHANGELOG.md`'s top section is the update prompt's text (release.yml), so it is
written for end users: a few one-line bullets of what changed. No explanations,
no "Needs web x.y" lines, no internals — the reasoning lives here instead.
Rule in RELEASING.md step 2.

## 2026-10 — Calendar files open in Kairos, read on the phone (v0.389.0 / web 0.581.0)

Tapping an `.ics` attachment (or sharing it to Kairos) opens New event filled in
from the file. Full rationale in the web repo's DECISIONS ("One calendar file,
read in two places"); the app-side choices:

- **Read on the device** — the owner's call: no connection needed, no server
  work. The rule is `ui/calendar/IcsImport.kt`, a line-for-line mirror of the
  web's `src/lib/calendar/ics-import.ts` (the web uses it for its Import .ics
  button). The two are held to parity by the web repo's
  `scripts/ics-parity/check.sh`, which compiles THIS file with `kotlinc` and
  diffs both readers over thousands of files. Change one, change the other,
  run it. Its first runs found a split emoji at the note cap and a crash on a
  three-digit year; both fixed in both, and `readIcsFile` never throws.
- **Intent filters, not a default.** VIEW and SEND for `text/calendar`,
  `text/x-vcalendar`, `application/ics`, `application/x-ical` on MainActivity.
  Android shows the chooser the first time; "Always" is the user's. SEND covers
  mail apps whose own "open" doesn't offer Kairos, and also takes a shared
  `EXTRA_TEXT` that is itself a VCALENDAR.
- **Read off the main thread, once.** The content URI is read on IO (a mail app
  may still be fetching the attachment), capped at 1 MB, into
  `AppContainer.pendingIcs`, and `pendingRoute = "calendar"`. `handleIntent`
  only imports when the activity is fresh (not a rotation or restore), so a saved
  event can't be re-opened as a second import.
- **The Calendar screen consumes it** once its data has loaded — the draft is put
  on `data.timezone`, the household clock new events default to — which also
  means it waits through sign-in, since `pendingRoute` is only acted on in the
  authenticated app. One event → `AddEventOverlay(importDraft = …)`, keyed on the
  draft so a second file restarts the form; several events, a cancellation, or
  nothing usable → an `AnimatedDialog` saying so (several points to subscribing,
  which is a parent job on the web).
- **Owner defaults to the person on the phone**, as for any new event; the
  Calendar picker can still change it. The type starts as Event so the
  description, which becomes the note, is kept.
- **An imported form is always "dirty"**, so closing it asks first instead of
  silently dropping the file.
- `CLIENT_BUILD` is back to `versionCode` (446). It had been left at 430; nothing
  broke only because `/api/v1/meta` reports `minClient: 0`.

## 2026-10 — Notes open on their own screen; the owner is a picker (v0.387.0–0.388.0 / web 0.580.0)

A short note on Events and Medical appointments only. `takesNotes` /
`NOTES_MAX` in `NoteField.kt` mirror the web's `event-notes.ts` exactly — a
blank `eventTypeId` is "no type" on both, so the phone never offers a field the
server would discard; a custom event type (stored as OTHER) is deliberately
excluded. 0.387 put the note inline; 0.388 made the row behave like the address
and title rows: tap it and the note opens on its own screen with Save, closing
without saving leaves it unchanged, and the row shows one line. The note is
displayed only in the event detail, under the address, never on grid chips.

The Calendar row now lists My calendar, Family calendar and each person, the
same choice as the web's Whose. Picking an owner drops them from Share with.
The server resolves and re-checks the owner (`create-event.ts`), so the picker
is a request, not an authority.

## 2026-10 — Each movement has its own buttons (v0.386.0 / web 0.579.0)

Every movement on a Log workout card gets its own Rest / skip, Calculator and
Log buttons under its own rule, so two movements added to one plan look exactly
like two plans sharing a muscle group. Logging one leaves the others alone (the
server clears only what a submission covers) and only the pressed button shows
the spinner. The calculator writes back to the movement whose button opened
it, not the card's first movement. "Edit weight" is read from what is logged for
the day, so it survives reopening the page, not just a save in the same session.

## 2026-10 — Companions: stage is earned, phase is current (v0.381.0–0.385.0 / web 0.574–0.578)

The web DECISIONS has the full thread; the rule the phone must keep: **`stage`
is earned growth, `phase` is what the companion is doing now, and nothing about
one may be inferred from the other.** Conflating them caused three bugs in a row
(shiny read as adult, so a shiny hatchling got an adult sprite; stage segments
hidden because shiny was read as finished; an egg held by a companion that
never grew). The
sprite follows growth actually done, never the glow.

What the card is now: one row of squares that fills with growth and breaks at
each stage boundary (break positions come from the server, not hardcoded), the
skill-blend colours kept on it; deepening on its own short bar, offered only on
a fully grown companion and worked through as a phase. No monthly hatch cap.
0.383: tap a companion in the gallery to make it active again — it resumes the
growth it had, the current one is shelved keeping its own, and the dialog says
so before you tap. Don't remove the bar or its segments because they look
redundant: the XP bar was deleted once by mistake and had to be restored.

## 2026-10 — School rows show ahead / behind (v0.380.0 / web 0.573.0)

Behind work is tinted on the row itself (it clears when done), not just a red
date under a heading that scrolls away. Pulled-forward or pushed-back work says
"ahead of Oct 20" / "moved from Oct 8" beside its due date, from the task's
original due date (web migration 119). An older server simply doesn't send it.

## 2026-10 — The history block beside the fields (v0.378.0–0.379.0 / web 0.569–0.570)

Three fixed lines to the right of the entry fields, above Log weight: Best
(heaviest ever, weight only), Best reps (most reps ever, with the weight), and
Latest (the last session even when below both). A line with nothing behind it
shows a dash so the block keeps its shape. No dates and no repeated unit on the
phone — the unit is already beside the box. The labels start in one column and
values end in another; "Recent" became "Latest" to match the web. The numbers
come from the server (`stats`, see "The history summary is server-computed").

## 2026-10 — The history summary is server-computed (v0.377.0)

Best / Best reps / Last arrive as a field on the movement rather than being
derived on the phone. The phone has the logged sets it needs for today, not the
whole history, and computing a record locally would mean two answers to "what is
my best bench" — which is exactly the class of bug that cost the last two days.

`MovementStatsDto` is appended last and nullable, so an older server omits it and
the block simply doesn't render. Nothing constructs `PlannedMovementDto`
positionally, but it still went last.

Rendered per movement, under its entry fields. On a one-movement card that is
the space above the Log weight button, which is where it was wanted; on a card
with three lifts each keeps its own, which a card-level block could not do.

## 2026-10 — Aligning the fields by structure, not by numbers (v0.376.0)

The entry boxes now sit in the same three weighted cells as the action tiles
below them, rather than being positioned with widths and spacers that happened to
look right. Both rows are `fillMaxWidth` children of the same Column with the
same 8dp gaps, so cell N and tile N resolve to the same x-extent on any screen.
Nothing has to be re-tuned for a different phone, which is the failure mode of
the alternative.

Each box is `weight(1f, fill = false).widthIn(max = NUM_FIELD_W)` — capped at
three digits, but able to shrink below that on a narrow screen instead of
overflowing its cell. A plain fixed width is what put sixteen columns off the
right edge of the attendance grid in 0.372.

One constant for every numeric box on the screen, so weight, reps and seconds
cannot drift into three sizes again — which is what they were.

`MovementRow` is the only implementation of that row and both call sites go
through it, so this lands everywhere the fields appear without a second copy to
keep in step.

## 2026-10 — The goal card loads on its own, not with the dashboard (v0.375.0)

The obvious place for the home-screen goal card was the dashboard payload, next
to `money` — that is how every other home card gets its data, in the one read
the screen already makes.

It went in its own view-model instead. The goal needs the server's progression
query, the heaviest read there is, and `/dashboard` is the single most-hit
endpoint in the app: folding it in would make every home refresh on every phone
pay for the goal card. A separate `CoopViewModel` means the dashboard paints
first and the card appears when it arrives — the same reasoning as the web's
Suspense boundary, reached by a different mechanism. It is also cache-backed
through `PayloadCacheStore`, so on a return visit or offline it paints
immediately from the last payload.

The side benefit is that this needed no server change at all. `/api/v1/coop`
already returns everything the card needs, including `isAdmin` and now
`carried`, so this is an app-only release.

`CoopDto.carried` is appended at the END of the data class and nullable. Against
a server older than web 0.565.0 the field is absent, decodes as null, and the
card falls back to the current month — no failure. Nothing constructs `CoopDto`
positionally, so appending was safe here, but the field still went last out of
habit after the `WorkoutLogRequest` near-miss.

A carried goal's gate comes from the carried record (`carried.gateMet`,
`carried.childrenMeeting`), never from `CoopDto.gateMet`. That top-level field is
this month's, and using it for a September goal would re-test an already-settled
month against an empty October counter — closing a gate the family had earned.

## 2026-10 — The client has to say which day it logged on (v0.374.0)

The server cannot infer it. A past `date` on a log means one of two things —
catching up on an overdue workout, or deliberately back-dating from the date
picker — and only the client knows which. Stamping "today" on every past date
would move a back-dated Saturday lift to Sunday, which is the same failure that
ruled out using `createdAt` server-side.

So `WorkoutLogRequest` carries an optional `completedOn`, set only when today
differs from the day being logged for. It is appended at the END of the data
class and every construction of that request is now NAMED rather than
positional: the request was being built positionally in SessionRepository, so an
inserted field would have silently shifted `replace` and `detectConflict`.

Captured at submit time, not at replay time. The write queue stores the
serialized body verbatim from the OkHttp interceptor, so a log queued offline on
Tuesday and synced on Thursday still reports Tuesday — which is when the workout
was actually done.

Older builds omit the field entirely and the server treats it as absent, so a
phone that has not updated behaves exactly as it did before rather than failing
validation.

## 2026-10 — Workout days was drawing off the edge of the phone (v0.373.0)

0.371 fixed the date window and the current week still did not appear, because the window was never
the whole problem. The grid drew a fixed sixteen columns: 16 x (18dp + 4dp gap) + a 12dp weekday
rail is ~364dp, and a phone's content width after card padding is ~330-360dp. The newest columns,
the week in progress among them, were laid out past the right edge of a Row that does not scroll.
The data was right, the dates were right, and the pixels were off-screen.

`BoxWithConstraints` now measures the available width and draws as many weeks as fit
(`(maxWidth - rail - gap) / (cell + gap)`, clamped 4..16), anchored so the current week is always
the last column. 14 weeks on a 360dp phone, 16 on a 412dp one, and older weeks fall away on their
own as time moves forward — which is the behaviour asked for rather than a fixed horizon.

The lesson for next time: when a layout fix does not take, check whether the thing is being drawn
somewhere you cannot see before changing the logic again. Two releases went into the date maths
while the real fault was that the row was wider than the screen.

## 2026-10 — Three, four, five muscle groups on a day (v0.372.0)

Matching the web: three and four cut from the centre via a hard-stop `Brush.sweepGradient` — thirds
as wedges, four as quadrants — because every piece meets in the middle and stays legible at 18dp.
Five or more would be slivers from a centre point, so those keep the horizontal bands.

Compose's sweep starts at 3 o'clock where CSS conic starts at 12, so the pieces sit a quarter turn
round from the web's. At this size that is not perceptible and it is not worth the rotation
gymnastics to match exactly; what reads is "three wedges" or "four quarters", not which colour is
where.

## 2026-10 — Grid window, stripes, and the Swap button (v0.371.0)

The attendance window had the same off-by-a-week fault as the web: `today.minusDays(111)` snapped
back to Sunday moved the start earlier without moving the end, so it finished at
`today - dayOfWeek` and the week in progress was missing. Now `startOfWeek(today).minusWeeks(15)`.

Three or more muscle groups on a day become equal vertical bands via a hard-stop
`Brush.horizontalGradient`; two keeps the diagonal. See the web DECISIONS entry for why.

`Swap` sat after a name pinned to `Modifier.width(150.dp)`, so the button was parked at the same x
whatever the name was and floated over empty space beside anything short. The name is
`Modifier.weight(1f, fill = false)` now: it takes only the width it needs so Swap follows it, and a
long name still ellipsizes at the weighted bound rather than pushing the button off the row. The
buttons no longer line up with each other, which is the point — they belong to the names.

## 2026-10 — Completion is identity, not a label (v0.557.0, shipped in v0.558.0)

Two planned workouts on one day both filed under Back are both *named* "Back", because a planned
workout's name is its muscle-group label. `TodayPlan` decided whether a row was logged with
`done.has(w.name.trim().toLowerCase())` against `doneLabels`, which is a list of session LABELS.
So logging one Back workout ticked both, the second could not be recorded through its own row, and
the only way to get it in was "Log a different workout".

Identity had been available the whole time: `loggedByPool` is keyed by pool-exercise id and was
already being used two functions away to prefill the weight fields. A planned workout is now done
when every one of its exercises has a logged weight for that date. A workout with no pool exercises
(HIIT, metric-only) still has nothing but its label to match on, so that path is unchanged and
keeps the same weakness.

The general shape: a label is a rendering of a thing, not the thing. Any time two rows can carry
the same label, matching on it is a coin flip that happens to be right while the data is sparse.

## 2026-10 — Gridlines, the rep floor, and the reset icon (v0.556.0 / app 0.370.0)

**The minor gridlines were invisible, not subtle.** They were `--color-hairline` — already a
near-white #dce3ea — dashed at 0.5 opacity, which on white is almost nothing. They are now a mid
grey at 0.28. Dashes read lighter than a solid line of the same colour, so this lands just under
the solid major lines rather than above them, keeping the hierarchy intact.

Compare draws them too. Without minor lines a bar that tops out above the highest common load (175
against a 155 label) floats over blank space with nothing to measure it by. `weightGrid` already
returned `minor`; Compare was only using `major`.

**A logged set is at least one rep.** `r.reps ?? 0` produced "175 lb × 0" for rows that predate
rep logging. Zero reps says the lift was not completed, which is the opposite of what a row in
`SessionSet` means — the set exists because it was done. The floor is 1.

**The reset button is a reset icon.** It was a calendar on both clients, which suggests opening a
date. The button undoes a selection and returns to today's plan, so `RefreshIcon` / `KairosIcons.Refresh`.

## 2026-10 — One axis, one chart per group (v0.555.0 / app 0.369.0)

**The axis is the dot chart's axis.** Compare was dividing its maximum into quarters and rounding,
which produced 0 / 44 / 88 / 131 / 175 — numbers nobody loads onto a bar. `weightGrid` in
`line-chart.tsx` already solved this for the dot plots: plate-step gridlines labelled at the common
loads. It is now exported and shared. Compare passes `lo = 0` so the bars keep a zero baseline — a
bar chart with a floating baseline lies about proportion — while the labels stay numbers a person
actually lifts.

**Charts belong to the group, not the movement.** Arms with a close-grip bench and an EZ bar curl
drew two "Additional charts" links and two near-identical plots with the same axis. The group is
what is being looked at, so one disclosure sits at the foot of it holding one plot with a line per
movement. Rep-max bars stay per movement inside it, since a rep-max table is about one lift.

**Width.** Bars went 16 to 26 with wider group gaps, and the SVG is centred and allowed to scale to
1.7x its natural width. Capped rather than unbounded: `width: 100%` on a wide screen scales the
labels along with the bars, and a chart whose text grows to 25px because the window is wide is not
better, only bigger.

## 2026-10 — Compare: a bar per weight, fixed width (v0.554.0)

One bar per person threw away the thing worth seeing. Someone who has worked up through 155, 175
and 185 has a progression; flattening it to a single "best" hides it, and the heaviest-weight /
most-reps toggle was two half-answers to a question better answered by showing the sets.

A bar is now one WEIGHT, carrying the best reps achieved at it. Not one bar per set: 175x2 and
175x3 are the same bar drawn twice, and for a given weight the honest number is the best you did.
`CompareSeries.bars` is therefore distinct weights, each with its best reps and the last date it
was lifted, sent newest-first so a cap on the client keeps what is current.

**Fixed width, never stretched.** A chart whose bars thicken as people are removed is a chart where
thickness means something it does not; the eye reads it anyway. Bars are 16px, gaps are constant,
and the SVG grows horizontally with scroll rather than redistributing.

**The budget is shared, not first-come.** `MAX_BARS / people` per person, so one prolific lifter
cannot crowd the others out. Within a person the slice is newest-first, then sorted lightest to
heaviest for display: a person's bars should climb rather than jump about in log order.

The axis starts at zero and the top rounds to something a person would have chosen (5/10/25/50),
because a bar chart with a floating baseline lies about proportion. Hover gives the exact weight,
reps and date, which the axis only approximates.

## 2026-10 — Compare as bars; colour follows the muscle (v0.553.0 / app 0.367.0)

**Compare is a bar per person.** It was a dot plot of everyone's sessions over time, which answered
a question nobody asks here: between people, the interesting thing is their best, not the shape of
their history. One bar each on one scale reads at a glance, and a toggle switches the scale between
heaviest weight and most reps.

Each bar carries the OTHER number above it — the reps at that weight, or the weight at those reps.
A bar alone is one number, and one number cannot tell you whether 175 for 2 beats 155 for 8.
`CompareSeries` therefore gained `bestWeight` and `bestReps` as whole sets rather than bare maxima,
so neither figure arrives without its context.

**Colour follows the muscle, not the theme.** Chart dots and rep-max bars now take the muscle
group's colour on both clients. That palette is a shared constant, identical on web and Android and
independent of the theme accent, so the chart reads as the same thing the body map just highlighted
and the two platforms agree regardless of which theme a device is set to.

Worth recording, because it looked like a bug and is not: the app's accent differs from the web's
because `ThemeScheme` is a LOCAL device setting in `SettingsStore`, not synced from the server. A
phone on OLIVE and a browser on TEAL are both behaving correctly.

Also: the rep-max pills under the app's chart said the same thing as the card directly above them,
detached from any chart and from each other. Removed. And "Best weight at each rep count" is now
"Best reps per weight" on both — note the rows are still keyed by rep count, so if the new name
means the data should pivot to one row per weight, that is a further change.

## 2026-10 — Both figures always; one disclosure, per movement (v0.552.0 / app 0.366.0)

**Both bodies stay.** `view` used to remove a figure — a deadlift showed only the back. Taking a
figure away made the layout jump and removed context the reader was looking at. Both are drawn
now, and `view` instead decides WHICH figure a movement paints: fills are computed per figure, so a
deadlift lights the back and leaves the front grey, a squat lights both, a bench press lights only
the front. The squat/deadlift distinction survives; the disappearing figure does not.

**One disclosure, and it is per movement.** The web had every section — rep maxes, lift progress,
workout days — behind a single "Show details" that got lost on the page; the app had already split
them. Both now agree:

- Under each movement's six tiles: **"Additional charts"**, holding that movement's dot plot (and
  its rep-max bars when it has any; the empty-state card is gone, because an empty card inside a
  disclosure called "Additional charts" is a chart that isn't one).
- Below everything, always visible: **"Lift progress"** (renamed from "Which lifts are moving")
  and **"Workout days"**.

**The whole-plan cards get the whole plan.** Both were being handed the body map's filtered
selection, so they shrank to whichever muscle was tapped. They describe the plan, so they take
every tracked movement. The web's dot chart also moved from per-group to per-movement, which is
where the app already had it.

## 2026-10 — The involvement table stays on the server (v0.551.0 / app 0.365.0)

Porting the body map to the app raised the obvious question: reimplement `involvement.ts` in
Kotlin, or send its answers? Send them. That table encodes what a deadlift works and which figure
it shows on — contested, researched, and already revised twice this month. Two copies would mean
two things to correct every time, and they would diverge silently, because nothing compares them.

`ProgressSeries` therefore carries `navRegion`, `shadePrimary`, `shadeSecondary` and `view`,
resolved once in `bodyMapFor()`. The clients render what they are told. The geometry is shared the
same way: one Python pass traces the artwork and emits both `body-map-paths.ts` and
`BodyMapPaths.kt`, so the two clients cannot show different bodies either.

What stays per-client is only what is genuinely per-platform: SVG paths and CSS variables on the
web, `PathParser` and `android.graphics.Region` on Android.

## 2026-10 — The body map needs the whole plan, not today (v0.550.1)

Tapping Legs on a Shoulders day did nothing. Not a click handler bug: `loadWorkouts` narrowed
`weightSeries` twice — to tracked movements, and then **to today's movements only** — so the page
was never sent a leg movement at all. Every region but today's was inert because it had nothing
behind it.

That narrowing was correct when the thing below the card was "today's chart". A body map is
navigation: its whole purpose is reaching a muscle group you are not training today. The payload
now carries `trackedSeries` (everything tracked, whatever day it belongs to) alongside the existing
`weightSeries` (today's slice, left intact for the places that really do mean today). The body map
and the whole-plan cards read `trackedSeries`; as a side effect the Workout days grid now spans the
whole plan instead of one muscle group.

The general shape of the mistake is worth naming: a UI that filters needs the unfiltered set.
Filtering upstream *and* downstream looks like defence in depth and is actually a dead end, because
the downstream filter can only ever narrow what it was given.

### typecheck-report.mjs: strict at the lines you edited, not across the file

"Any error in a touched file is fatal" resurfaced five pre-existing cascade errors in a 1200-line
query file where ten lines moved. The rule now uses `git diff -U0` hunk ranges (padded three lines
either side): noise is excused away from the hunks and still fatal inside them. Verified by
reintroducing a break at an edited line and confirming it is reported.

## 2026-10 — Body map: today first, one colour per group (v0.550.0)

**The bug.** 0.549.0 shipped two solid black figures. The component asked for `var(--accent)`,
`var(--hairline)`, `var(--surface)` and `var(--fg)`; the app defines `--color-accent`,
`--color-hairline`, `--color-surface` and `--color-ink`. An invalid `fill` is not ignored — SVG
falls back to black — so every region painted black and the whole map looked like a silhouette.
The lesson is narrow and worth keeping: a CSS variable name is an API, and this one was assumed
rather than read. The stray rectangle across the thigh in the same screenshot was the browser's
default focus ring on a focused `<path>`, which is drawn around its BOUNDING BOX; `outline: none`
is now set inline, and keyboard focus is shown as a dashed version of the selection ring instead.

**Today is the default, not a single group.** A day that trains Core and Legs is a Core-and-Legs
day, so the map opens with both lit and both sets of charts shown. Picking a region narrows to it;
a calendar button returns to today. With nothing planned — a rotation, or no plan — it falls back
to the most recently trained region, which is the same answer the server gives for `defaultGroup`.

**One fixed colour per muscle group** (`MG_COLOR`), used by the body, the heading above each chart,
and the Workout days legend. `GRID_COLORS` was positional: a group's colour depended on which
other groups happened to be present, which is tolerable for an ad-hoc legend and useless once the
colour has to mean something. Ungrouped movements still fall back to the positional list, having no
fixed colour of their own. The hues echo the source artwork's key, so the map reads like the
reference illustration rather than a recolour of it.

Shading resolves primary over secondary: a muscle one shown movement trains is not dimmed because
another shown movement merely assists with it.

**Said once.** The muscle group was named three times on screen — today's chips, a label under the
map, and the heading above the charts. The heading stays; the other two are gone. The highlight
says which group is meant, and the heading names it.

## 2026-10 — The body map: selection and shading are different fields (v0.549.0)

The progress page showed every muscle group at once, which was too much. A body you tap is the
replacement, and building it forced the question the deadlift had been asking all along.

**Selection is not shading.** Each traced region carries two attributes:
- `nav` — which tap target a click resolves to. One per region.
- `group` — which muscle group it lights up when a movement works it.

They diverge exactly where it matters. The lower back and glutes are one obvious place to press,
but the pixels under it belong to two groups: the obliques and lumbar erectors are CORE, the glutes
are LEGS. `navRegionFor()` answers "what did they click"; `groupsFor()` answers "what does it work".
Forcing one field to do both jobs is what made the deadlift unfileable for three releases.

**The lower back is part of the core.** Core is the whole trunk — rectus abdominis and obliques in
front, erector spinae and multifidus behind — not just the abs. Treating "core" as "abs" had led to
the conclusion that Core could not be shown on the posterior figure at all. It can: it is the
erectors. A plank now correctly lights the lower back on the back view.

**The artwork did the anatomy.** The source PNG has white separator strokes between individual
muscles, so flood-filling inside them yields real regions — traps, lats, erectors, glutes — rather
than one green mass to slice with an arbitrary horizontal line. Traced with cv2.findContours +
approxPolyDP into `body-map-paths.ts` (~16 KB, 81 paths). Nothing is hand-drawn.

**Selection rings trace the union, not each path.** Stroking every path in a target drew a ring
around all thirteen leg muscles and read as scribble. Each target therefore ships a separate
outline path, traced from the union of its regions after a binary closing to bridge the white seams.

**What the body cannot reach keeps its own block.** A movement with no muscle group, or a FULL_BODY
lift, has no region to be selected from, so those render below the map instead of becoming
unreachable. `navRegionFor` returns null for both.

Keyboard: one tab stop per TARGET, not per path — thirteen focusable leg regions per figure would
put seventy tab stops between the keyboard and the rest of the page.

## 2026-10 — Typechecking: excuse the noise, not the unknown (v0.548.1)

`prisma generate` cannot run in the sandbox — binaries.prisma.sh is unreachable — so
`src/generated/prisma` is absent and `tsc` reports ~460 cascade errors where Prisma row types
collapsed to `any`/`unknown`. The habit had been to grep the report for the error codes that look
build-breaking.

That is an **allowlist**, and it fails silently in the only way that matters: the first error code
nobody thought to list goes straight through. It let two real breaks reach a Docker build —
`TS2538: Type 'null' cannot be used as an index type` (from widening `muscle` to `MuscleGroup | null`
without guarding `MUSCLE_GROUP_LABEL[muscle]`), and two `TS2551`s where client code used the
server's field name `poolExerciseId` on `GraphSeries`, whose field is `exerciseId`.

`scripts/typecheck-report.mjs` inverts it. An error is excused only when it can be ATTRIBUTED to the
missing client: a known cascade code whose message actually names `unknown` or `{}`. Everything else
is fatal, including codes never seen before. And **any** error in a file the working tree has
touched is fatal regardless of code, because those are the files under test.

The distinction that matters: `TS2538` naming `'{}'` is a collapsed Prisma row and is excused;
`TS2538` naming `'null'` is a real bug and is not. Attribution is by message, not code alone.

The script is checked in and verified by reintroducing the 0.548.0 break and confirming it exits 1.
Run `node scripts/typecheck-report.mjs --changed` before packaging any web release.

## 2026-10 — A one-day swap is remembered on the set, not inferred (v0.538.0, shipped in v0.538.1)

The app can swap a planned movement for a variation for one day (app 0.353). The set lands under the
variation's id, so the planned slot came back blank on the next load: the log was right, the screen
looked wrong. Inferring "this unplanned set must have replaced that planned one" is guesswork, so the
link is now **stored**: `SessionSet.swappedFromId` (migration `116_set_swapped_from`) holds the
planned movement's id, written only when it differs from what was logged.

`loadTodayPlannedWorkouts` keys the day's sets by `swappedFromId ?? poolExerciseId`, so a swapped set
fills the slot it replaced, and the movement reports `loggedAs: { poolExerciseId, name }` — what was
actually done. Clients show the slot with the variation's name and its value instead of a blank row.

## 2026-10 — A movement can belong to no muscle group (v0.548.0)

Seven muscle groups cannot file a deadlift. The EMG literature is no help: the 2020 PLOS ONE
systematic review found erector spinae and quadriceps *more* activated than glutes and hamstrings,
with glute-vs-hamstring results contradicting each other between studies. The biomechanical reading
cuts the other way — the erectors are near-isometric, holding the spine while the hip and knee do
the moving. Both are true; they measure different things. There is no filing that is simply correct.

So the model stopped requiring one. `muscleGroup` was already nullable; now the UI can actually set
it to null, and **a movement with no group charts as its own block, titled with its own name**,
sorted alphabetically among the groups rather than swept into an "Other" bucket. It is a peer, not
a leftover.

This matters beyond tidiness. Filing a deadlift under CORE puts a 300 lb hinge in the same progress
block as a 45-second plank and the chart stops meaning anything; filing it under BACK sits it with
rows and pull-ups, which share no joint action with it, and would have a rotation put a Back day
next to a Leg day while both tax the same glutes and erectors. Its own block avoids choosing.

Selection and highlighting are now deliberately separate concerns:
- **Highlighting** is `involvement.ts`: a deadlift shades glutes, lower back, legs and core, on the
  posterior figure only. Many regions, derived from the movement.
- **Selection** is one nav region per movement — for the deadlift, lower back/glutes. One region,
  chosen for navigation, not anatomy.
  Forcing these to be the same field is what made the deadlift awkward in the first place.

Rotation slots keep requiring a muscle group. A slot is a *day* and a day has a theme; `defaultGroup`
reads `slot.muscleGroup` to decide what opens. A day having a theme and a movement having an
identity are different questions.

Also: front squat's SHOULDERS secondary dropped. The delts are loaded isometrically in the rack
position, which is not shoulder training.

## 2026-10 — Three kinds of person, one progress view (v0.547.0)

A rotation and a weekly plan are not variants of one thing. `loadTodayPlannedWorkouts` queries
`plannedWorkout` by `dayOfWeek` and never consults the rotation, and **`RotationSlot` has no
exercises relation at all** — a slot is a name, a category, a muscle group and a rest flag. So a
person on a rotation has no planned movements in the database, and a person with no plan has
nothing either. Driving progress off the plan gave both of them an empty view while their logged
history sat in `SessionSet`.

Progress is now built from **logged sets**, with `tracked` kept as a flag per series rather than as
the filter. Clients prefer tracked movements when any exist, so a weekly plan still leads with its
own lifts; everyone else now has something instead of nothing. This deliberately softens the
earlier "only tracked movements should appear" rule, which was correct for the person who set it
and wrong for the two cases that have no tracked movements to show.

Three decisions the server now makes once, so the clients cannot drift:
- **Grid rows**: the plan's weekdays, else the rotation's non-rest weekdays, else the weekdays that
  carry a logged session, else empty and the card hides. A rotation is still a plan — what it
  lacks is a weekly shape, not meaning.
- **Opening group**: today's plan, else today's rotation slot, else the most recently trained
  group. Someone with no plan still has a last workout, and that is the one they want.
- **Muscle group per movement**: the plan's filing where there is one, the movement's own otherwise.

## 2026-10 — Movement involvement, and why a deadlift is a leg exercise (v0.546.0, shipped in v0.546.1)

`src/lib/workouts/involvement.ts` maps a movement name to the groups it works beyond the one it is
filed under. Three rules keep it honest:

**The group a person filed a movement under always wins for primary.** The table only adds
secondaries, so it can never re-file someone's pool behind their back. Where the filing disagrees
with the anatomy — a deadlift kept under Core — the suggested primary demotes to a secondary
rather than vanishing, because otherwise that deadlift would shade no legs at all.

**Matched on name, not id.** The pool is user-created, so there are no fixed ids to key on. That
means no migration and it applies to existing data immediately; the cost is no per-exercise
override until a column earns its place.

**The deadlift is primarily LEGS.** Hip extension makes the gluteus maximus the prime mover; the
lumbar erectors and lats hold an isometric contraction. EMG work finds erector activity in
deadlifts comparable to hip thrusts and other lower-body lifts, so it is not uniquely a back
exercise however it feels afterwards.

That left squats and deadlifts both on LEGS with no way to tell them apart. The fix is not another
muscle group — it is the artwork: the body map has a front and a back, so each rule carries a
`view`. Hip-dominant pulls light the posterior legs, knee-dominant squats light both, leg
extensions the front. Seven groups stay seven groups and the body still distinguishes them.

Two bugs the table caught only because it was run against the real movement names rather than
invented ones: the deadlift demotion above, and `/\bplank\b/` failing on "planks" — the trailing
word boundary broke every plural. Test fixtures should be the user's own data.

## 2026-10 — A weights plan may hold something that is not a weight (v0.546.0, shipped in v0.546.1)

`metricChoicesFor("WEIGHTS")` returned `["WEIGHT"]`, so every movement in a weights plan had to be
logged as a load. A plank in a Core session therefore asked for pounds. It now offers DURATION and
REPS as well, and the involvement table suggests which: holds are time, counted core work is reps.
Category sets the default, never the ceiling.

## 2026-10 — Shipped is not the same as reachable (v0.542.0)

The detail cards went into `PersonalTop`, which renders only when `personal` is true, the person's
overlay is open, and the overlay is on its menu step. The exercise page renders the per-person
cards with `personal` defaulting to **false**, so the work was live and invisible, and it was
reported as missing because it effectively was.

The check that would have caught it is tracing the component up to a route before claiming it is
done, not grepping that the symbol exists. A typecheck proves a component compiles; it says nothing
about whether anything renders it.

The headline is now its own `LiftHeadline` component used at both sites rather than markup living
inside one of them. Charts draw points with no connecting stroke (`dots` on `LineChart`), including
the Compare card. Compare keeps the chart only: its series are **people** on one movement, so the
per-lift cards ("which lifts are moving") would be meaningless there.

## 2026-10 — The lift detail: three cards, no new queries (v0.541.0)

Behind the headline numbers, "Show details" opens three cards, each answering one question:
**what you can lift** (best real weight at each rep count, bars per movement), **which lifts are
moving** (percent change over 90 days across every tracked lift), and **did you show up** (a
16-week grid of days with a logged set).

All three come from data already on the wire. The 90-day change is computed from the series
points, which carry full history rather than a window. The consistency grid is the union of dates
that carry a logged set — which is why it is labelled "sessions logged" and not "sessions": a
rested or untracked day leaves no mark on it, and the label has to say so rather than imply the
person did nothing.

Percent is used for the cross-lift card because it is the one honest way to put a deadlift and an
overhead press on a shared axis, and the real weights stay in the row so a 5 lb gain on a 95 lb
press cannot pass for a big one. Still no estimated 1RM anywhere.

Two fixes found while reading that code. A rep-max chip printed `\u00b7` as JSX **text**, where it
is not an escape, so it rendered as those six characters — the same bug already fixed once for
`\u00d7`. In JSX, an escape only works inside a string or template literal, never as element text.
And the web logging page grew the phone's three labelled tiles: `ActionButton` in `workouts-grid`
has the right shape but cannot be imported here, because that module already imports this one, so
the tile is defined locally rather than creating a cycle.

## 2026-10 — A name belongs in exactly one place on a card (v0.540.0, shipped in v0.540.1)

The card had grown three places that print a name: the plan name under the muscle group, a
summary line listing every movement in the plan, and — added with the swap control — a name
above each movement's own fields. Together they read "Core / deadlift / deadlift". Reported as
a regression, which it was not; it was a new row landing on top of two that were already there.
Worth remembering before adding any label: check what the surrounding component already prints.

The layout now is one muscle group at the top, one rule, then each movement named once directly
above its fields with its swap control on the same line, and one rule between movements. The
plan name is hidden inside a group card entirely, since the group heads the card and every
movement names itself.

The same duplicate reached the board's workouts strip from a different direction: that row lists
the day's plan names, and two plans for one muscle group are two rows upstream, so it printed
"Core \u00b7 Core \u00b7 Legs". It now collapses repeats before truncating to three, since a duplicate
otherwise also costs one of the three slots.

The doubled rules came from the same kind of overlap: the group wrapper drew a divider between
plans and `PlanRow` drew its own above the fields, so the two sat together. Only one owner of a
rule per seam.

## 2026-10 — The swap list is grouped, and a log clears only what it sent (v0.539.0)

Two fixes that belong together.

**The picker.** Both clients sorted the pool with the current movement's muscle group floated to
the top and everything else alphabetical. That is not grouping: below the first few rows, chest,
calves and shoulders ran together in one list. Both now render a heading per muscle group — the
movement's own group first, then the rest alphabetically, unassigned last under "Other". The
lesson is that "sorted so the relevant ones are near the top" is not what people mean by grouped;
they mean they can see where one group ends.

**The log.** `logPlannedWorkout` did `deleteMany({ sessionId })` before rewriting, which is correct
only while every one of a plan's movements is always submitted together. It now clears just the
movements the submission covers, matched on **both** `poolExerciseId` and `swappedFromId` so a
swapped set does not survive alongside its replacement as a double. This is what makes a plan
splittable across several cards without one card wiping another's work.

Note the two clients still differ here: the web action creates a fresh session per planned log
while the phone reuses the day's session for that plan. The scoped delete fixes the phone's path;
the web's duplicate-session behaviour is untouched and is the thing to settle before cards are
split by movement.

## 2026-10 — The sandbox can typecheck after all; use it (v0.538.1)

0.538.0 failed its Docker build on a one-word mistake: `PlanRow` gained a `bare` prop in its type
and at every call site, but not in the destructuring, so `bare` was an undeclared name (`TS2304`).
Brace-balance and symbol greps — the verification relied on until now — cannot see that, and it
cost a build.

`npm ci` **does** work in the sandbox (~45s, 247 packages), so `npx tsc --noEmit` runs. What still
does not work is `prisma generate`: the schema engine comes from `binaries.prisma.sh`, which the
sandbox proxy refuses with 403 (`PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` and `--no-engine` do not
get around it). Without the generated client every Prisma result is `any` or `{}`, so the repo
reports ~459 errors that are pure cascade. The usable check is therefore a **filtered** one: run
`tsc --noEmit` and discard `TS7006`/`TS7031`, `TS2307` on `@/generated`, and the `unknown`/`{}`
errors downstream of them. Whatever survives the filter is real — and crucially the errors that
break builds (`TS2304` undeclared name, `TS2322` bad prop type, `TS2554` wrong arity) do survive it,
because none of them depend on Prisma types.

Run it before packaging any web release. Inspection is the fallback, not the method.

## 2026-10 — Same-muscle plans share a card (v0.538.0, shipped in v0.538.1)

Two chest plans on a Monday used to be two separate cards with nothing saying they were the same
session's work. They now group: one card, the muscle group named once at the top, each workout with
its own fields and buttons below a divider. Grouping is by `PlannedWorkout.muscleGroup` only —
grouping by name would merge two unrelated plans both called "Workout" — and a plan without a muscle
group keeps its own card. `muscleGroup` now rides along on the planned-day payload so the phone can
group identically.

## 2026-10 — The lift view answers "where am I now" first (v0.538.0, shipped in v0.538.1)

A line over all history answers a question people rarely ask. Each tracked lift now leads with its
**record** (heaviest set and the reps it was done for), then **change over 30 days**, **how long
since that best** (a stall is information), **session count**, the **last five sessions** as
weight×reps chips, and the **rep-max row**. The chart stays underneath for the long view.

Three rules behind it: every number is a real logged set (no estimated 1RM, anywhere); nothing is
compared across lifts, because a deadlift and a shoulder press share no scale; and the 30-day delta
is **null**, not zero, when there is nothing that old to compare against — a first session is not a
gain.

The web's graphable universe is now **tracked planned movements**, matching the phone, which has
always filtered that way. Before this the web also charted anything ever logged, so the same person
saw different lifts on the two clients.

## 2026-10 — Reps ride along with the weight; the record stays the weight (v0.537.0)

Progress was `Math.max(weight)` per movement per day with reps discarded, so 185x5 and 185x12 logged
identically and every week of rep progress between weight jumps was invisible. `SessionSet` has
always had `reps` and `setNumber` — the gap was in what the log UI collected, not the schema, so this
needed no migration.

The design decision, and it is the owner's: **the record is the weight.** Reps are context carried
beside it, not a number that redefines the record. Estimated 1RM is explicitly rejected as a stat —
its only acceptable use is as a "you could try this" hint when choosing a load, never stored and
never charted.

What that unlocks, all from real logged sets:

- **Day points carry their reps.** On a tie in weight the set with more reps wins the day, because it
  is the better set.
- **The record per movement**: the heaviest set ever, shown with the reps it was done for.
- **A rep-max table**: best weight actually lifted at each rep count that has been logged. No
  interpolation, no estimates, only rep counts that exist.

Deliberately NOT done: per-set logging. The schema supports it, but five sets x two fields per
session is friction that stops people logging at all. One top set with an optional rep count is two
taps and captures most of the signal. An optional "add set" can come later if it is ever wanted.

Both progress paths were updated — the web's `weightSeries` in `queries/workouts.ts` and the device
payload's `ProgressSeries` in `queries/workout-log.ts`. They are separate queries doing the same
thing; a change to one needs the other.

## 2026-10 — A missed workout must be clearable from where it is shown (v0.536.0)

The Overdue list on the exercise pop-out rendered each missed day's plan so it could be *logged*, but
offered no way to say "I'm not doing that". The only route was to switch the date picker to that day
and use the Rest day button there — which nothing on the Overdue list pointed at. The quick **Rest**
on the card header has always meant today (`restDay(user, todayISO)`), correctly, but that made it
look as if skipping were already available and broken.

Each overdue entry now carries **Skip this day**, calling `restDay(user, thatDate)` and bumping a
tick that re-reads `overdueWorkoutDates`, so the row disappears as soon as it is cleared.

This was the web half of the same mistake the app made (app 0.349.0): an action that can apply to
more than one day has to carry the day, and the UI that *shows* a day's problem has to offer that
day's resolution. Surfacing overdue work without a way to dismiss it just moves the nag.

## 2026-10 — The display name is a parent's call, not self-service (v0.535.0)

`updateProfile` is reachable by `requireAdminOrSelf`, which is right for a picture, a colour and a
birthday — those are yours. The name shown on every board, card and task in the house is not: anyone
could rename themselves to anything and it propagated everywhere (`displayName ?? name` is used
throughout). It is now admin-only.

The gate is in the **action**, not just the form: a non-admin's save writes back `user.displayName`
unchanged no matter what the field contains, so a hand-posted `displayName` does nothing. The form
shows the current name as read-only text with "Ask a parent to change this" for non-admins, and
renders the input only for an admin — who can still set it for anyone from the same page, so nothing
moved for parents.

Note the dependency on `isAdmin()` semantics: with no admin PIN set and sign-in not required, it
returns true, so a household running the open-tablet configuration is unchanged by design. Locking
the name down in that configuration means setting an admin PIN.

## 2026-10 — Deepen costs the egg, not a monthly hatch (v0.534.0)

"Deepen" consumed a ready egg **and** one of `EGGS_PER_SEASON_CAP` (3) hatches, in exchange for
`shiny = true` — which renders as a single ✦ beside the companion's name and nothing else. Nobody
would rationally trade a new creature for that, so the button was a trap sitting next to the one
people actually want.

A deepen now consumes the egg (base XP reset, `eggsHatched + 1`) but leaves `eggsThisSeason`
untouched, and is therefore offered in the **capped** state as well — all three hatched this month,
XP for the next egg already earned, nothing else to spend it on. That is where it earns its keep.
Writing `eggsThisSeason` back unchanged is also what keeps the month rollover correct: the value is
read as 0 when the stored `seasonKey` is a past season, so a deepen on the 1st rolls the key forward
without inventing a spend.

Two guards came with it: the server rejects a deepen on an already-shiny companion (it previously
wrote `shiny = true` over `shiny = true`, ate the egg and changed nothing), and both clients hide the
control in that state rather than relying on the error.

**Shiny is now visible, which is what makes the trade worth taking.** One gold, `#f5b400`, shared by
both clients: a radial glow behind the creature, an Overlay tint on the sprite, the name in gold, and
the star. `characters/collection` now selects `shiny` and marks a species shiny if any owned copy is,
so a deepened creature keeps its gilding on the shelf — gold frame, lit cell, star — long after it
stops being the active companion. The **egg** is never gilded; only what hatched from it. Shiny still
has no effect on growth, rarity or luck, and that is deliberate: it is a trophy, not a stat.

## 2026-10 — The egg meter must not round up past the gate (v0.533.0)

`incubationPct` was `Math.round(progress / cost * 100)` while the Hatch button is gated on
`progress >= cost`. Anything from 99.5% up therefore displayed **"Next egg 100%"** with no Hatch
action anywhere on the screen — which reads as a broken feature, not as "nearly there". The meter now
floors and holds at 99 until the egg is genuinely ready, so 100% means exactly one thing.

The gate itself is unchanged and is deliberately two conditions: `eggReady = progress >= cost &&
eggsThisSeason < EGGS_PER_SEASON_CAP`, and `eggCapped` is the same with the cap reached. Both false
means the XP isn't there yet; `eggCapped` means it is, but this season's three are spent and the
season (a calendar month by default) hasn't rolled. `eggsThisSeason` resets by comparison against
`currentSeasonWindow().startISO`, so a month rollover frees the cap without a write.

Diagnosing one of these is a data question, not a code one — the state lives in `CompanionState`
(`incubationBaseXp`, `eggsHatched`, `seasonKey`, `eggsThisSeason`) against the person's lifetime XP,
with the cost being `FIRST_EGG_XP` (80) for the first egg and `EGG_XP` (250) after. Read the row
before theorising.
## 2026-10 — Which dashboard sections are "the day's" and which are "now's" (v0.531.0)

The app prefetches tomorrow so a morning outage still has a page. That only works if a dashboard
asked for a future date is actually that day's page, so each section had to be classified rather than
left on the blanket `dayISO === today` gate it had grown:

- **Built for the requested day** (read-only, already take a date): the day's **schedule**,
  **chore badges**, and **reading progress**. These were gated for no reason beyond the gate being
  easy, and a prefetched tomorrow with no schedule on it is exactly what a user would notice.
- **Date-aware only after v0.532.0**: `loadReadingProgress` picked the active goal against
  `todayISO()` internally and `pendingBibleRewards` was handed the server's `today`, so moving them
  out of the gate in 0.531 made them *look* day-specific while still computing today's answer under
  tomorrow's date. Both now take the requested day (the reward one matters at a month boundary: which
  months count as ended changes on the 1st). The lesson: moving a call out of a `dayISO === today`
  branch is not the same as making it date-aware — open the function and check what it does with the
  date it isn't being given.
- **Current state, no date at all**: `pendingMoneyCount` — a pending approval is pending whenever you
  look; it is not a property of a day.
- **Still today-only, by meaning**: `getAhead`, school progress / get-ahead, `upForGrabs` and
  `alwaysOpen` (a chore is up for grabs *now*, not on a day that hasn't arrived), `workoutOverdue`
  (overdue is measured against the real today), and the admin money banner.

**`ensureGenerated` keeps its `dayISO !== today` guard — do not remove it.** It looks like the reason
a future day would be incomplete, and it isn't: `generateChores`, `generateRecurringTasks`,
`generateWorkoutTasks` and `generateReadingTasks` each run with a **14–30 day horizon from today**, so
tomorrow's rows already exist in the database by the time anyone asks for tomorrow. What the guard
actually prevents is those generators being re-run with a *future* `fromISO`, where their prune step
would be evaluated against a window that no longer starts at today — a mutation, triggered by a read,
on data for a day that hasn't happened. The only single-day generators (`generatePoolChores`,
`generateAnytimeChores`) feed exactly the two sections that remain today-only, so nothing is lost.
## 2026-09 — Icon batches are checked before they ship (`tools/check-grocery-icons.py`)

Two icon defects reached production because nothing looked at the art after slicing, and neither is
visible at 20px in a list row:

1. **The sheet's card and caption were kept** on 13 icons (sunscreen, sponges, plastic-cutlery,
   paper-plates, pain-reliever, lotion, hand-soap, light-bulbs, batteries-pack, allergy-medicine,
   air-freshener, first-aid, dryer-sheets) — the slice took the whole grid cell instead of the object,
   so the white tile, its grey stroke and the printed label all shipped as part of the icon. Repaired
   in v0.530.0 by removing the card's white fill (tight ≥242 threshold, seeded from the border so
   white *objects* like plates and bulbs survive — a looser grey threshold eats them, which was tried
   and rejected), clearing the 4px stroke ring, dropping the low-saturation caption glyphs in the
   bottom third, then re-cropping. No re-generation needed; the art itself was intact.
2. **Clipped art** — ~55 icons run off the bottom of their own canvas, so a bottle has no base
   (grape-juice is the reported case). This one is **not repairable in post**: the pixels were never
   in the PNG. It needs the affected items re-generated, or the original sheets re-sliced with a box
   that follows the object rather than the cell.

`tools/check-grocery-icons.py` now detects both and exits non-zero, so an icon batch can be gated on
it. Clipping is detected by a **hard, fully-opaque run along a canvas edge** — a real silhouette
fades to alpha 0 at its boundary, a cut does not, which is what distinguishes "the art was cut" from
"a flat-bottomed object touches the edge". Run it against `public/grocery-icons/kairos` as the last
step of every icon batch, before bundling to the app. Note the known false positives: shopfront icons
(supermarket, convenience-store, delivery-truck, farmers-market, liquor-store, online-order) sit on a
deliberate flat baseline, and paper-plates trips the white-area check because the plates really are
white.

## 2026-09 — Grocery quantity lives on the line, not in the name (v0.529.0 / app 0.339.0)

`ShoppingItem.quantity` is a nullable 1-99 integer (migration `115_grocery_quantity`). The obvious
cheap alternative — letting people type "Distilled water x10" as the item name — was rejected: the
name is what the catalog remembers and what the icon matcher reads, so a count baked into it creates a
junk catalog entry with a 📦 icon and breaks the suggestion dedupe. Keeping it as its own column means
the catalog, the icons and Re-sync are all untouched by it.

- **Null is the whole "off" state.** `setItemQuantityCore` clears the value for null, a non-number, or
  anything outside 1-99, so an emptied box, a typo and a hostile API caller all land on "no quantity",
  and the line renders exactly as it did before the feature existed. There is no "× 0" and no "× 1"
  special case to explain — 1 is a legal quantity and displays.
- **One renderer rule, four surfaces**: `"<name> × <n>"` when set, the bare name when not — the web
  board, the web cart, and both the saved list and the trip list on the phone.
- The web puts it behind a small `#` button per line that swaps into a two-digit field (commit on
  blur or Enter, Escape reverts); the app shows the box only in edit mode, beside the move/delete
  icons, and commits **on focus loss rather than per keystroke**, so typing "10" is one write, not a
  write for "1" and another for "10".
- The app write goes through the same optimistic + offline queue path as move/purchase, with
  `groceries/quantity` added to the pending-write replay so a change made offline survives a reload
  instead of flickering back.

## 2026-09 — The shipped icon set is offerable as suggestions, without becoming catalog rows (v0.528.0)

The add-an-item list is the household's own catalog, which means an item nobody has bought yet can
only be typed — and a typo creates a second catalog row with a guessed icon instead of matching the
custom art. `src/lib/groceries/suggestions.ts` now holds all 244 `kairos:` items with their canonical
names, generated from the `kairos:` rules in `catalog.ts`, and both clients show catalog ∪
suggestions with the catalog row winning a name clash (case-insensitive).

**They are deliberately not rows.** Seeding them with a migration was the obvious alternative and was
rejected: it would put ~244 unused rows in every household's catalog, and "Re-sync catalog" (which
merges duplicates and refreshes icons) would then have real rows to reconcile against whatever the
household had typed. A suggestion carries no `catalogId`, so picking one goes through the ordinary
add-by-name path: the server creates the row and guesses the icon. Nothing to merge, nothing to
de-conflict.

That only works if a suggestion's name guesses back to its own icon. Every one of the 244 was
round-trip checked through `guessIconInfo`; seven didn't resolve (milk, soda, soup, spices,
mayonnaise, frozen vegetables, stir-fry — the first three matched an emoji rule, the rest nothing),
and the fix was to **widen the matcher rules**, not to rename the items to something that happened
to match. Bare "milk", "soda" and "soup" now resolve to the custom icon rather than 🥛/🥤/🥫; the
kairos rules sit first in `ICONS`, so on an equal-length tie they win. Re-run that round-trip check
after any icon batch — it is what caught the mismatch.

The app carries the same list bundled (`GrocerySuggestions.kt`) so it works offline, which means an
icon batch now touches `catalog.ts`, `suggestions.ts` and the Kotlin mirror together.

## 2026-09 — Custom `kairos:` grocery/store icon set (v0.510–0.521)

Grocery and store icons are stored as a short **token** on the row and rendered by a single
component per client. Three token forms exist:

- a plain **emoji** (still the default for anything an emoji renders well);
- **`ic:<name>`** — five legacy hand-made PNGs (napkin, papertowel, waterbottle, protein, sorbet);
- **`kairos:<slug>`** — the custom colourful set (~226 PNGs today), which is where all new art goes.

**MDI (`mdi:*`) is retired** (v0.516). The bundled Material Design Icons were monochrome and read as
"black blobs" next to emoji; every generic item they covered now resolves to an emoji or a `kairos:`
icon. Do not reintroduce a monochrome icon family. (The earlier "bundled MDI for the emoji gaps"
decision below is superseded by this one; `public/grocery-icons/MDI-LICENSE.txt` is kept only as the
attribution record for the retired set.)

**Rendering.**
- Web: `GroceryGlyph` in `src/components/icons.tsx`. `kairos:<slug>` →
  `<img src="/grocery-icons/kairos/<slug>.png">`; `ic:*` → the map of legacy paths; a bare emoji is
  printed as text. Any **prefixed token we can't resolve renders 📦**, never the raw string — that box
  is the true fallback and the signal that art is missing on this client.
- App: `GroceryGlyph.kt` (`ui/groceries/`) with two maps, `GLYPH_DRAWABLES` (`ic:*`) and
  `KAIROS_DRAWABLES` (`kairos:*`) → `drawable-nodpi/grocery_<slug>.png`. Hyphens in the slug become
  underscores in the Android resource name. Same 📦 fallback.
- Store icons render through the **same** component as item icons (v0.513/0.521), so a store shows its
  picture on the shopping board, the cart page and the add-to-store picker.

**Matching and picking.** `src/lib/groceries/catalog.ts` holds all three: `ICONS` (the name → token
matcher), `GROCERY_ICON_LIBRARY` and `STORE_ICON_LIBRARY` (the searchable picker pools the admin UI
queries). Specific `kairos:` phrase rules are ordered **before** the generic emoji rules and win by
phrase length, so "cherry tomatoes" matches the tomato rule rather than the cherry one.

**Gotchas that cost real releases:**
1. `setStoreIcon`/`setCatalogIcon` once truncated the saved value to **8 characters**, which silently
   mangled every `kairos:` token into a broken image (v0.517). The cap is now 40 — never reintroduce a
   short slice on an icon value.
2. **Ship the server before the app.** The phone can only render art it has bundled, so a token the
   server starts emitting before the matching APK is installed shows 📦. Server first, app second.
3. An HTML `<option>` cannot contain an image, so store **dropdowns** show text; every other surface
   shows the picture.

**Icon creation pipeline (repeatable).** An image tool generates a labelled grid sheet; the sheet is
sliced programmatically (border flood-fill background removal, connected-component detection,
OCR/positional label stripping), each icon named by slug, verified to carry no baked-in label text
(OCR plus an eyeball), downscaled to ~160px, and bundled to **both** repos with the token wired into
`catalog.ts` and `KAIROS_DRAWABLES`. The generation prompt must demand the **label stay clear of the
art** — bold labels touching the object get sliced in, which is exactly what forced the re-cuts in
v0.514 (prepared meals) and v0.515 (stores).

## 2026-09 — Calendar time model: real instants, day segments, exact bounds (v0.521–0.526)

This is settled architecture. Do not reopen it; extend it.

**Storage.** An event stores real `startsAt`/`endsAt` instants. Nothing stores a "day + minutes" pair.

**Layout.** The grid DTO (`src/lib/queries/calendar-page.ts`, `CalEvent`) flattens an event into
per-day **segments**: `dayISO`, `startMin`, `endMin`. In a segment, **`1440` means "the end of this
day" and is a layout boundary only** — it is never an editable clock value and never round-trips to
the server.

**Editing.** The same DTO carries the event's **true bounds**: `startDayISO`, `startMinExact`,
`endDayISO`, `endMinExact` (`toWire` falls back to the segment values when an event doesn't span
days). The editor loads these, so an overnight event (10 PM → 1 AM) opens as the whole event no
matter which day's segment was tapped, and saving a title-only change can't rewrite its end (v0.523).

**Midnight is 00:00 on the next day, never 23:59.** Clock values stay in 0–1439. The app's
`TimePickerDialog` clamps input to 0..23:59 purely as a crash guard (Material3's
`rememberTimePickerState` throws on hour ≥ 24 — the original bug); the clamp is not the time model.

**Two server paths — don't confuse them.**
- The **app** posts to `/api/v1/calendar/event*`, which calls `computeTimes()` / `createPersonalEvent`
  / `updatePersonalEvent` in `src/lib/calendar/create-event.ts`. That path honours `endDate` and
  rejects an end at or before the start.
- The **web** form uses its own server actions in `src/lib/actions/events.ts`, with separate all-day
  handling; it does **not** call `computeTimes`. A change to one path is not automatically a change to
  the other — this has been mis-stated in review before, so check the file.

**All-day is inclusive in the UI, exclusive in storage.** A one-day all-day event shows the same start
and end date; storage keeps the exclusive end (last day + 1). Convert −1 on load and +1 on save.
Both clients have Starts/Ends date fields for multi-day all-day events (app v0.333, web v0.525), and
flipping the All-day switch normalises the dates/times on both (v0.526) instead of producing a
zero-length timed event or gaining a day at the midnight boundary.

**Feedback.** An invalid interval disables Save and reddens the offending field. The app has this;
the web form's version of the red-field/disable feedback, and hiding the exclusive end, are the small
remaining cosmetic gaps (tracked in ROADMAP).

## 2026-09 - Concurrent weekly + rotation (union, each pausable)

A rotation used to suppress the weekly plan in the generator (rotationUsers skip in the planned and
schedule loops). Removed that: both plans now generate independently, so a weekly plan and a rotation
run together and a day is prompted if either schedules it (one prompt per day; the two plans' details
show/log in their own sections and screens). The weekly plan is gated by a per-user weeklyActive
setting (default on); "0" pauses it (no weekly prompts) so it can sit dormant beside a rotation and be
resumed later. The rotation's pause is the existing stop=deactivate (0.505). No migration (settings).
Both plans logging differently (weekly = tracked exercises; rotation = a session/slot) means the
overdue/day-detail merge stays weekly-centric for now; refine if needed after on-device use.

## 2026-09 - Weekly plan optional start date (no migration; via settings)

Weekly plans can now be scheduled to begin on a future day. Stored per-user as a `weeklyStart:<id>`
key in the existing appSetting store (no migration). setWeeklyStart writes it; the generator loads
all such keys and, in the weekly loop, skips any date before a user's weekly start (alongside the
trainsSince/createdAt clamp). Empty/absent = active now (unchanged default). Because a start date is
future-only, past overdue is unaffected. Web: a "Starts on" DateField on the plan editor. App control
and the concurrent weekly+rotation work (each independently pausable, both workouts allowed on the
same day - union, no per-day resolution) are the next releases; both also settings-based, no
migration.

## 2026-09 - Switching weekly <-> rotation preserves both (stop = deactivate)

Stopping a rotation used to delete it (slots cascaded), so switching to the weekly plan lost the
rotation. Both stop paths (stopRotation action, stopRotationCore) now set isActive=false instead,
keeping the rotation and its slots; the generator already ignores inactive rotations and loadRotation
already returns null when inactive, so nothing downstream changes. startRotation already reactivates
an existing rotation, so switching back restores the saved cycle. The weekly plan (PlannedWorkouts)
was always preserved across a rotation. Net: one active plan at a time, both saved, switch freely.
Web gap closed: the weekly editor now has a "Use a rotation instead" switch (it already had "Back to
weekly plan" on the rotation side); the app already had the Rotation entry + stop, so it inherits
this with no app change. Deferred (need their own design + a migration): a user-set start date for
the weekly plan, and running a rotation concurrently with the weekly plan (per-day source of truth).

## 2026-09 - Overdue workouts respect when a planned workout was added (weekly plans)

loadOverdueWorkoutDays judged each past day by loadTodayPlannedWorkouts(userId, iso), which loaded
the CURRENT weekly plan's exercises for that weekday with no time bound. So building or changing a
weekly plan made earlier days - already worked out under the previous plan - look overdue, because
the new plan's exercises hadn't been logged back then. (This was the actual bug behind the "overdue
last week" report; the earlier 0.502/0.503 rotation re-anchor work fixed a real but different
rotation path, not this - the user is on a weekly plan.) Fix: loadTodayPlannedWorkouts now filters
plannedWorkout by createdAt < start of the next day, so a workout only counts for dates on/after it
was added - the same trainsSince floor the task generator uses. The overdue list is computed live on
each load, so this clears an existing false backlog immediately with no data change and no effect on
logged history. Safe for the other caller (today's plan view): current workouts all have createdAt
<= today.

## 2026-09 - Rotation anchor (cycle start date) exposed to the Android app

The web rotation builder already had a "Cycle starts on" date field (setRotationAnchor action); the
Android editor had no equivalent, so a rotation user could only change slots/rest days, never the
start. Added a workouts/rotation/anchor API route (POST { date } -> setAnchorCore) so the app can set
the anchor, and a "Cycle starts on" control on RotationScreen that opens a date picker defaulting to
today. Setting it to today is the one-tap way to start an edited plan immediately and let the
generator sweep any stale overdue prompts - the deliberate version of the 0.502 re-anchor-on-edit fix.

## 2026-09 - Editing a rotation plan re-anchors it to today (no retroactive backlog)

The workout generator backfills an overdue window behind today and rebuilds each person's expected
workout days from their current plan. The weekly-schedule path clamps on effectiveFrom (reset to
today by setScheduleDays) and the weekly-planned path clamps on the earliest plannedWorkout
createdAt, but the rotation shape-edit cores (addSlot/removeSlot/moveSlot/setRestDays) changed the
cycle while leaving anchorDate untouched. So editing a rotation that was anchored weeks ago made the
generator recompute the whole backfill window under the NEW shape against the OLD anchor, inventing
"overdue" prompts for days the old shape never scheduled - even though those days were already
logged under the old plan. Fix: reanchorTodayIfPast() rolls a past anchorDate up to today on any
shape edit, so an edited plan takes effect immediately (from slot 0 today) and the generator's sweep
drops the phantom pending prompts. A future anchor the user set deliberately is left alone (only past
anchors are moved). This is the "assume it starts immediately" behavior; the alternative the user
floated - ask for a start date and keep the old plan running until then - needs the old shape kept
alongside the new one and was deferred. No migration (uses the existing anchorDate).

## 2026-09 - Grocery icons: bundled Material Design Icons for the emoji gaps (mdi: tokens)

> **Superseded (v0.516).** `mdi:` tokens are retired — see the `kairos:` icon-set decision at the
> top of this file. Kept for the history of why a monochrome set was tried.

Items that emoji represented poorly now use Material Design Icons (Pictogrammers, Apache-2.0),
stored as `mdi:<name>` tokens in the same icon string field: soda -> bottle-soda-classic, juice/oil
-> bottle-tonic-outline, yogurt/creamer -> cup-outline, flour -> sack, sugar -> spoon-sugar, spices
-> shaker-outline, sauces/condiments -> soy-sauce, cleaning -> spray-bottle, soap/shampoo -> pump,
tissues -> box, diapers -> diaper-outline, pet -> bowl-mix-outline. Chips/crackers/gum keep emoji
(MDI had nothing better) and the five ic:* customs stay. Rendering is bundled, not fetched (offline
first): web inlines the path from src/lib/groceries/mdi-paths.ts with fill=currentColor; Android
renders app res/drawable/mdi_*.xml vector drawables tinted to the content color. Both GroceryGlyphs
now also fall back to a box for any unknown prefixed token instead of drawing the raw string. This
is why the app (0.315) must ship before the web (0.501) emits mdi: tokens - an older app would draw
the literal text. Room caching is unaffected: the icon is just a longer string on the same payload.

## 2026-09 - Grocery icon matching by head noun + confidence, and locks folded into "manual"

The icon guesser was "first rule in the ICONS list whose keyword appears anywhere wins", so a
modifier stole compound names: "cherry tomatoes" -> cherry, "apple juice" -> apple, "fish sauce" ->
fish. guessIconInfo() now collects every matching rule and prefers the match that ends latest (the
head noun of a "modifier head" name), tie-broken toward the longer/more specific match so phrase
rules like "peanut butter" and "sweet potato" still win. It returns a `confident` flag: false when
nothing matched or two disjoint rules did (a real compound), true for a single match or a phrase
rule that spans its components. The admin derives `needsReview = !iconLocked && !confident` (not
stored, no migration) and surfaces those for one-tap confirm (setCatalogIconLock true) or correction
(picking an icon, which also locks). The visible lock toggle is gone: iconLocked now simply means
"set/confirmed by hand", which re-sync already skips -- so a manual icon is permanent without a
button to reason about. Also raised the setCatalogIcon length cap from 8 to 40 chars, which was
truncating prefixed tokens (ic:papertowel) picked from the palette. Verified the matcher on real
compound names before shipping. This is server-only Release 1; MDI artwork for the weak icons
(soda, juice, yogurt, flour, sauces, tissues, diapers, pet, ...) is the paired web+app Release 2.

## 2026-09 - Home card headline: "Nothing due today" instead of a get-ahead count

The School and Chores home cards headlined the get-ahead backlog when nothing was overdue or due
today, e.g. "180 to get ahead". That number is the sum of up to MAX_PER_SUBJECT (30) upcoming items
per subject, so it read as a to-do count ("do 180 things") when most of it is simply the rest of the
year's lessons - confusing and misleadingly large. Both cards now show "Nothing due today" in that
state. The get-ahead items are unchanged and still listed in the card's Get ahead section; only the
one-line headline changed. School's aheadCount, used only for that headline, was removed.

## 2026-09 — Grocery catalog: icon picker, lock, and custom-image display in admin

Three related admin improvements. (1) The item icon cell was a plain text input, so a custom image
icon showed its raw token ("ic:protein") instead of the picture; it now renders via GroceryGlyph
(image for ic:* tokens, emoji otherwise), same as the shopping board. (2) A picker on each row offers
the palette the guesser knows (exported as ICON_CHOICES from groceries/catalog.ts, the distinct icons
from the keyword map), rendered as their real glyphs; free-typing any emoji still works. (3) A new
iconLocked column (migration 102) lets a locked icon survive a catalog re-sync: resyncCatalogCore uses
the keeper's own icon when locked and re-guesses only unlocked items, while still merging duplicates.
Choosing an icon by hand (picker or type) auto-locks it (setCatalogIcon sets iconLocked=true), since a
deliberate choice shouldn't be re-guessed away; the per-row lock toggle (setCatalogIconLock) releases
it back to re-sync. Web-only; no app change.

## 2026-09 — Server idempotency regression tests (locking in the offline-create contract)

The offline-create idempotency now spans eight independent create paths (book, grocery add,
grocery catalog add, money, task, school, calendar event, recurring task) and exists for a failure
mode manual testing can't reproduce on demand — "DB commit succeeds, HTTP response is lost, the
client retries." Added a small vitest suite (test/idempotency.test.ts) that calls each core twice
with the same clientId against a real disposable Postgres and asserts one row / one id (for
recurring, one template, since a series has no single id to return). No production behavior changed
and there is no migration, so APP_VERSION is intentionally NOT bumped — this is test-only tooling.
The schema is built by replaying the project's own migration SQL in MIGRATIONS order via pg in a
vitest global-setup (the datasource carries no url and production applies migrations with its own
runner, so prisma db push isn't the mechanism here). server-only and next/cache are stubbed via
vitest aliases so the cores load outside the Next runtime. CI: a new Server tests workflow spins up
a Postgres service, runs prisma generate, and runs the suite; it uses npm install rather than npm
ci because the lockfile wasn't regenerated for the added vitest devDependency. test/ and
vitest.config.ts are excluded from tsconfig so the Docker/Next build ignores them.

## 2026-09 — Idempotency for calendar events and recurring tasks (completing the offline set)

Migration 100 gave clientId idempotency to Book/Task/MoneyEntry/ShoppingItem but missed the two
other offline creates. Migration 101 closes them. Calendar: Event gains a global `clientId @unique`
(family events have a null userId, so the key can't be per-owner; a random uuid is globally unique
anyway), createPersonalEvent does a findFirst on clientId before inserting and now returns the
event id, and the calendar route reads clientId and returns the id — so a calendar event created
offline reconciles its temp id to the real one exactly like every other item. Recurring tasks:
RecurringTask gains `clientId` + `@@unique([userId, clientId])`, and createRecurringTask recognizes
a retried create and skips making a second series. Deliberately, the recurring route still returns
only `{ status: "ok" }` with NO id: one recurring create fans out to many Task rows, and the
Android SyncManager treats a returned `id` as the real replacement for a `temp-...` Task id, so
returning a RecurringTask id there would mis-remap. The app needs no change for recurring — it
already sends the clientId on the same AddTask request. A newly created recurring placeholder can
still be acted on before it syncs; that is left as a known UX limitation rather than a queue
redesign. Also hardened the grocery cores: on a rare concurrent duplicate (two identical adds race
past the pre-check, one loses the unique-index insert) they now catch the unique conflict and
return the winning row instead of throwing. The other cores are left as-is: without the catch a
concurrent loser gets a 500, which the app already retries, and the retry's pre-check then finds
the committed row — eventually idempotent, with the unique index still preventing any duplicate row.

## 2026-09 — Server-side idempotency key for offline creates (clientId)

The Android app already sends a durable `clientId` (a random uuid, the client's temp-id) in the
body of every create it makes offline. The server now persists it and uses it as an idempotency
key, so a create the app retries after its response was lost — the row was committed but the id
never got back to the device — is recognized and returns the existing row instead of inserting a
duplicate. Each create core (books, groceries add + add-catalog, money entry, tasks, school work)
does a `findFirst` on the clientId before inserting and returns the existing id if found; the new
row stores the clientId. Migration 100_client_idempotency adds a nullable `clientId` column plus a
unique index to Book, Task, MoneyEntry and ShoppingItem. The column is nullable so every existing
row is unaffected, and a plain unique index over a nullable column allows unlimited NULLs while
enforcing uniqueness on real client ids (a race between two identical retries hits the index rather
than double-inserting). Book/Task/MoneyEntry key on `(userId, clientId)` since they have an owner
column; ShoppingItem keys on `clientId` alone (groceries are a shared household list with no direct
user column, and clientId is globally unique by construction anyway). School work and plain tasks
both write Task, so both are covered by the one Task key; recurring tasks never set a clientId and
so are exempt (their NULLs don't collide). This is the server half of the Android 0.311/0.312
offline-sync work; no app change is needed — the clientId was already on the wire.

## 2026-09 — Create endpoints return the created id (Android offline reconciliation)

The create APIs (books/add, groceries/add, groceries/add-catalog, money/entry, tasks/add,
school/add) returned only `{ status: "ok" }`, discarding the row they had just created. They
now return the created id (books `book.id`, money `entry.id`, tasks/school the created
`task.id`, groceries the `shoppingItem.id`). The success result types carry the id as
OPTIONAL (`{ ok: true; id?: string }`) so the shared update paths and other callers are
untouched, and because the Android client parses with `ignoreUnknownKeys` this is
backward-compatible with existing app builds (they ignore the new field). Recurring-task
creation is excluded — it can materialize multiple Task rows, so there is no single id to
return. Purpose: the Android app can swap an optimistic `temp-<uuid>` id for the real id after
an online create, so a later action (delete/move/complete) never references an id the server
never had.


## 2026-09 — Game time becomes monitoring-only; a collector container is the ingest boundary (pre-build)

Game time is being stripped down to **passive monitoring of minutes played by
children** — by game or in total, either is fine. The token / daily-allowance /
bonus-minute / manual-logging machinery is retired: it was web-only and already
hidden from web nav and the app sidebar, so nothing external calls it. No
enforcement or control; just an honest record of time played.

Collection is deliberately **decoupled** from Kairos behind a stable,
source-agnostic ingest contract, because every upstream Xbox source is fragile.
Microsoft is actively moving Family Safety's private APIs — in mid-2026 Xbox was
pulled out of the Family Safety mobile app into a separate **Xbox Family
Settings** app; the reporting data (daily/weekly totals, per-game, screen time)
still exists, but every reader of it is unofficial and breakable. Kairos never
holds Microsoft or Steam credentials and never talks to those services directly.

**The boundary is a small dedicated "playtime collector" container** — not Home
Assistant talking to Kairos directly, and not brittle HA YAML automations. The
collector owns every per-source adapter and emits one fixed JSON shape to Kairos
(`{child, date, source, game?, minutes}`); Kairos owns the history and the UI.
HA is used *as a source* the collector reads (so we don't hand-maintain the
Microsoft reverse-engineering, and MS credentials stay in HA's `.storage`, off
Kairos), but HA is not the contract — if HAFamilySafety breaks, that one adapter
is swapped inside the collector and Kairos never notices. Steam is its own
adapter polled directly (official Steam Web API `playtime_forever` deltas — no
reverse engineering). The weekly Xbox email is a reconciliation cross-check.
Kairos ingest needs a **new shared-secret service token**: no external-ingest
auth exists today (only per-device bearer + Authelia session). Data model +
contract land after direction is confirmed. (See ROADMAP → Game time.)

## 2026-09 — v0.301–0.349 decision log (reconstructed after the git slip)

DECISIONS.md fell ~69 versions behind when uncommitted entries were lost to a
stray `git checkout`; reconstructed from `version.ts` CHANGES and current code,
grouped by theme.

**Saved addresses (0.301–0.312).** A shared address book so event locations are
picked, not retyped, and carry a full address for phone navigation.
Self-contained — no external geocoder; type-ahead runs over the saved list.
Parent/admin submissions land approved; members' land pending an admin queue
(0.304–0.305). Simplified from categorized to a **single flat searchable list**
(0.308) — categories weren't earning their keep. Calendar "Where" is a
saved-address combobox with a "did you mean?" dedup (0.303); a matched location
shows its friendly name over the raw address (0.309), with a per-address "open
in maps by name" toggle (on for businesses, off for homes). Addresses is its own
page under Calendar admin, edit-gated with pencil/trash per row (0.310–0.312).

**Admin menu + lock (0.311, 0.313).** Admin menu reordered to follow the
sidebar; Device/appearance/email/household/season grouped under Settings. The
lock icon now does a **full page load** after the PIN so the admin session is
recognized on the current page's section — a soft navigation was bouncing back
to the general hub. (Same class as the existing "full navigation after
auth/admin-lock" rule.)

**Calendar & class overlays, and an app-styled date picker (0.314–0.328,
0.331, 0.335).** Event and class overlays unified: same width, side-by-side
sections (Share with beside Reminders, Starts beside Ends), the same pill
dropdowns with one inset chevron everywhere, explanatory paragraphs removed.
Share-with/Reminders became class-style toggle buttons across every event type,
the bell shown only once a person is selected, the owner dropped from the share
list. Classes gained reminders (saved onto the class's meeting event, reusing
the notification pipeline), a Subject type-or-pick combobox, a Where field, and
a Color dropdown with swatches. The browser's native date popup was replaced by
an **app-styled DateField** — first in the calendar, then everywhere it appears
(School, Tasks, Money, Chores, Bible plans, exercise logs, profile birthday,
calendar pause); it closes on any outside click. Custom reminder lead times
replaced the fixed "1 day".

**Event types (0.282, 0.306).** "Other" → "Medical / Dental" (red by default).
"Appointment" → "Event" everywhere it shows; the underlying type is unchanged so
existing events keep their color and behavior.

**Recurring tasks (0.285, 0.293–0.298).** Repeating to-dos (daily /
weekly-on-days / monthly; end never / after-N / on-date) render on the right
days from a template. Recurring history is capped to the **last 2 completed
occurrences** per template (older pruned). Editing edits the **series in place**
(completed occurrences preserved); a recurring occurrence resolves to its whole
series for edit/delete. Recurrence is creatable from the app (task-add endpoint
takes frequency/interval/weekdays/ends; admin form and app share one core).
Optional per-task alert time flows to the app's scheduler.

**Onboarding: 8-character invitation codes (0.287–0.292).** Invitations are a
short 8-char code you can text, read aloud, or paste; entering it runs the full
setup (new password / confirm / reset) then enrolls the device — replacing email
links, which clients strip. Each person has an "Add a phone" action distinct from
"Reset password". (Web `/join` and the legacy enrollment-code path were retired
— see the `/join` entry below.)

**Workout integrity (0.329–0.332).** Fixed workouts silently disappearing:
rest-day / mark-done / log-scheduled were grabbing the day's *first* session and
overwriting it, clobbering a separately-logged workout. Those actions now only
ever reuse the day's own bare/scheduled placeholder and never touch a
separately-logged workout, sport confirmation, or rest marker. Logging the
**same movement** twice in a day now prompts update-or-cancel instead of
silently duplicating; a different movement still logs on its own.

**Subscribed calendars (0.323–0.324, 0.333, 0.342–0.345).** Feed names are
edit-gated with inline rename + remove. A subscribed event can carry per-phone
reminders and — briefly — a manual address; the **web** manual-address/reminder
editor was then **removed (0.333)**: reminders on feeds are set from the app,
and most feeds already include an address. A feed can be **shared with several
people** (names and profile colors blend on its events, like shared events).
**Retiring** a finished feed (all events past) converts its events to permanent
regular events, keeping owner + shared-with members as attendees so names
persist, then removes the subscription. Reminders on subscribed events are **per
person** — each phone keeps its own minutes.

**Subscribed-calendar internals.** Retiring converts owner + shared-with members
to `EventParticipant` rows first (names persist); feed members' profile colors
are added to `memberColors` (blend); reminders are per-person via
`SubscribedReminder(eventId, userId, minutes Int[])` with
`@@unique([eventId,userId])` and an Event back-relation. The app's calendar
payload builder (`calendar-page.ts`) overrides each feed event's `reminders`
with the viewer's own.

**Tasks screen collapse (0.346).** The tasks screen (web + `/api/v1/tasks`)
shows **one line per recurring template** with a repeat label ("Every week ·
Mon"), not a row per occurrence. The **web** tasks screen has **no check-off** —
ticking happens on the home card or a person's app; the web screen is a clean
overview.

**Shared-device "Family" profile (0.339–0.341).** A shared web device shows a
**Family** profile in the sidebar (family color + family picture, both set in
Appearance) instead of the signed-in admin; signing out is gated behind the
admin PIN. Tapping Family opens a page listing each phone and the app version it
runs. The family calendar color moved from Calendar settings into **Appearance**
(0.339).

**Time format (0.344).** A 12-/24-hour setting under Calendar settings; in
24-hour mode the picker reads a typed `2315` as 11:15 PM.

**Auth cleanup (0.347).** The legacy `loginToken` was removed from the login
response now that every phone is on a current build; the login route stays (it's
the phone-unlock password check) and still returns the person, just without the
unused token. `src/lib/api/login-proof.ts` deleted. Web-only.

**Event form (0.349).** The weekly "On these days" selector defaults to and
follows the **start date's weekday** until the user manually toggles days; a
manual pick stops the auto-follow.

## 2026-09 — Retired the web `/join` page; onboarding is app-only

Onboarding moved fully into the Kairos app (enter an invitation code → set/confirm
password → enroll, all in one step). The old web `/join` redeem page is now gone:
deleted `src/app/join/*`, removed `redeemInvite` + `inviteIsRedeemable`
(`lib/accounts.ts`), `redeemInviteAction` + `RedeemState` (`lib/actions/accounts.ts`),
and `baseUrl` + `inviteLink` (`lib/url.ts`, which now only exports `appJoinLink`).
Invite/reset emails dropped the "on a computer" web link and carry only the code
plus the `kairos://join?token=…` paste fallback. All `/join` path-guards
(middleware, gate, sidebar, top-date, user-badge, content-pad) were removed too.

**Done (v0.299):** retired the `EnrollmentCode` path — removed `/api/v1/auth/enroll`,
`issueEnrollmentCode`/`redeemEnrollmentCode`/`newEnrollmentCode` and the code
constants from `device-auth.ts`, `issueEnrollmentCodeAction` + the `qr.ts` lib,
and the `EnrollmentCode` model (migration `82_drop_enrollment_code`, idempotent
`DROP TABLE IF EXISTS`). The admin **"Phone app"** panel stays — it only lists /
revokes devices; enrolling is via the invite buttons (`/auth/join`).

**Correction (v0.300).** `/api/v1/auth/login` is **not** vestigial. Tracing the
shipped app (GitHub HEAD, v0.156) settled it: `SignInScreen`/`SignInViewModel`
are gone, but `SessionRepository.unlock()` calls `svc.login()` to re-verify a
locked phone's password before unlocking (it reads `person` and reuses the kept
device token; it ignores `loginToken`). So `/auth/login` + `signLoginProof` stay.
The `loginToken` field must also stay in the response: the client's
`LoginResponse.loginToken` is a **non-nullable, non-default kotlinx field**, so
omitting it would fail deserialization and break unlock on deployed builds — it
can only be dropped in lockstep with an app release that defaults/removes it.
Only `verifyLoginProof` (used solely by the removed `/auth/enroll`) was truly
dead and was deleted. `docs/API.md` was rewritten to match: onboarding via
`/auth/join` + `/auth/join/check` + `/auth/forgot`, `/auth/login` as the unlock
password check, and the retired enrollment-code flow noted as history.

**How to verify a route is dead before removing it:** re-clone the *app* repo
fresh from GitHub (it tracks what's deployed), then trace the call graph — an
`ApiService` method or a `SessionRepository` method can linger with no reachable
caller, or (as here) turn out to have a live one in a place you didn't expect
(`unlock`). A grep for the endpoint string alone isn't enough.

## 2026-09 — App-facing API: device-authed cores, lenient responses, avatars

Building the Android client to full parity settled a few patterns worth keeping.

- **Device-authed routes call `requireDevice`, not the `"use server"` actions.**
  The actions gate on an Authelia session (`requireInteractive`/`requireCanActFor`)
  which a device token doesn't have. So each `/api/v1` route authenticates the
  bearer token and delegates to a **shared core** extracted into a lib
  (`lib/workouts/mark.ts`, `plan-edit.ts`, `rotation-edit.ts`,
  `queries/workout-log.ts`). Cores skip the session gate but still run side
  effects (`generateWorkoutTasks()` after any plan/rotation change).
- **Return shapes must be tolerant.** The Kotlin client defaults every DTO field.
  Mutation routes may return `{ status: "ok" }`; that's fine. Don't rely on the
  client to reject a partial body.
- **Avatars for the app.** `/api/avatars/*` sits behind Authelia and the app
  can't reach it, so there's a device-authed mirror `GET /api/v1/avatars/[file]`.
  `personPayload` sends `avatarUrl` pointing at that path plus `avatarPosition`
  (`"tx ty scale"`); the app reproduces the web's `translate()/scale()` transform.
- **Bible reading (v0.204).** Personal-reading writes moved into a guard-free
  core `lib/bible/personal-core.ts` (plan create/delete, day mark, book chapters,
  bulk books); the `"use server"` actions (`actions/personal-plan.ts`,
  `personal-bible.ts`) now just gate and delegate, and the `/api/v1/reading/*`
  routes call the same core after `requireDevice`. Reads use one aggregate
  (`queries/reading-page.ts` → `GET /api/v1/reading`) mirroring the Bible page.
  The family reading has **no completion endpoint** — family completion is a
  BIBLE task on the dashboard, not the Bible screen, matching the web page.
  `color` was added to `personPayload` (so `/me` and every person object carry
  the person's colour, used for their coverage bars and trophy).
- **Chores overview (v0.206).** `GET /api/v1/chores` (`queries/chores-page.ts`)
  is a read-only aggregate mirroring the web `/chores` page — no completion (that
  stays dashboard tasks) and no management (that stays the PIN-gated
  `/admin/chores`, web-only). Scope is driven by the **token's** person, not a
  session: the web uses `personalVisibleIds()` (kind only — parent sees kids); the
  app deliberately widens this to **parent OR admin** sees the household, per
  product call, so an admin who isn't parent-kind still gets the household view.
  Non-admin children see only themselves. Always-open + pool stay household-wide.
  (v0.209: the household view shows the **whole active household — every parent
  and child**, not just self + kids, so a parent sees their own and other parents'
  chores here even when none are assigned. App `/chores` endpoint only; the web
  `/chores` page keeps the shared `personalVisibleIds` scoping, reused by
  school/money/game-time.)
- **Dashboard shared chores (v0.207–0.208).** The app Home mirrors the web
  person-page "home" block: the day's **personal reading** (`personalReading`,
  toggled via `/reading/mark`), plus **up-for-grabs** and **always-open** chores
  (`upForGrabs`/`alwaysOpen` on `/dashboard`), shown to **everyone** (not gated).
  Up-for-grabs is **chores only** — the web only ever releases chore-generated
  (`locked`) tasks, so schoolwork etc. is never releasable; the API filters to
  `CHORE` to enforce it. On a single-person device "anyone can take these"
  resolves to the enrolled person, so `POST /chores/claim` and
  `POST /chores/always-open` act for the token's person (no person-picker like the
  shared tablet). Shared guard-free cores in `lib/chores/dashboard-actions-core.ts`;
  the web actions gate then delegate.
- **Calendar — phased (v0.210, Phase 1).** The calendar is large, so it ships in
  phases. Phase 1 is read-only Month/Agenda/Day: `GET /api/v1/calendar`
  (`queries/calendar-page.ts`) mirrors the web personal calendar's data exactly —
  same saved prefs (view, shown people/subs, family, school-work), same filter,
  and the same server-side `recolorForPersonal`, so a person's web colour and
  filter choices carry straight over. Colours are resolved on the server because
  the in-app colour-personalisation UI is deferred to Phase 5 (the DECISIONS
  "colour model rework" — best tuned hands-on once the base is in). Time-grid
  views (week/3-day) + swipe paging are Phase 2, add/edit is Phase 3, the options
  drawer is Phase 4.
- **Calendar timezones — viewer-local (fixed-instant).** The household model: an
  event is pinned to a timezone (default the home-server tz, and — once Phase 3
  event creation lands — selectable per event), and the calendar shows it at the
  wall-clock time it **actually occurs where the viewer is**. On a travelling phone
  a 9 AM home-tz event displays at its device-local equivalent; at home (device tz
  == home tz) nothing shifts; all-day events never shift. The server keeps sending
  home-tz times + the home tz id; the **app** converts each timed event to the
  device tz via its real instant (DST-safe, `withZoneSameInstant`), and the
  now-line runs on device time. App-side only for now; covers the common travel
  case (same calendar date, a few hours of offset). Cross-date-line, per-event tz
  overrides, and any server-side re-bucketing come with Phase 3. (This replaced an
  earlier now-line-in-household-tz approach — the opposite of the desired model.)

## 2026-09 — Edit plan on the app mirrors the web builder

Weekly plan editor (view + add via category→muscle→exercise / named workout /
rest, remove, mark-rest, copy-from-day) and Rotation (start/stop, rest-weekday
mask, 10-day preview computed server-side via `slotForDate`, slots add/remove/
reorder). Slot **edit** and **anchor date** are the remaining rotation bits.


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

## 2026-09 — Android app: technical shape (scaffold, app v0.1.0)
**Decision:** the `kairos-app` client is built as: Jetpack Compose (Material 3,
single-activity) · Navigation-Compose with type-safe routes · Retrofit + OkHttp
with kotlinx.serialization (unknown fields ignored, per docs/API.md) · DataStore
for settings · the device token encrypted with an AES-256-GCM key in the Android
Keystore · **manual DI** (a small AppContainer), not Hilt. Toolchain is pinned in
a Gradle version catalog (AGP 8.13 line, Kotlin 2.2, compileSdk/targetSdk 36,
minSdk 26, JDK 17) — AGP 9 is deliberately deferred. Auth state is a single
`SessionState` flow that gates the whole UI (Setup → Enroll → Home); there is no
"navigate to login", so the soft-navigation bypass class can't occur.
**No deployment specifics in the repo:** the server base URL is user-entered at
first launch and editable any time; no host, handle, or LAN address is baked into
the source. The repo ships pointing at nothing.
**Reason:** keeps the maintenance surface and rebuild risk low (codegen-free
except serialization; lean dependency set), matches the identity model already
built server-side, and keeps a public repo free of any household's details.
Room/WorkManager/FCM and QR scanning are deferred to later increments.
**Avatars caveat:** uploaded avatar photos (`/api/avatars/*`) stay behind the
reverse-proxy auth and are not fetched by the app yet; the emoji `avatarIcon` or
initials cover identity display until a token-authed avatar path exists.

## 2026-09 — Mobile app auth: login + code (layered), code-only for kids
**Decision:** the phone app authenticates on the account credential, not on the
enrollment code alone. A person **with a password** enrolls with **login + code**:
`POST /auth/login` verifies username/email + password and returns a short-lived,
HMAC-signed **login proof** (carrying the user id and `credentialVersion`); the
app hands that back to `/auth/enroll` alongside a device code, and the server
mints a device token only when both are valid **for the same person**. A person
**without a password (a child)** enrolls by **code alone**, generated by a parent
in the admin panel — the parent's authenticated session is the auth, the code
binds the device to the chosen child.
**Reason:** device enrollment is one layer, not the whole identity. On a public
deployment the account password must be the gate (Authelia can't be assumed for
others running Kairos). Requiring both factors means a leaked password can't
enrol a new device and a leaked code can't impersonate a password-holder. The
no-password path stays only for passwordless kiosk/shared mode and local testing.
**Increment B (done, v0.188):** a `credentialVersion` column on `Device` records
the password version it authenticated at. When a password account's version
bumps (password change/disable), every request returns `reauth_required`; the
phone stays enrolled and clears it via `/auth/reauth` (password only). Explicit
revoke still cuts a device off entirely. Passwordless children are never gated.

## 2026-09 — Scoped `/api/v1` Authelia bypass: rule specified
**Decision:** the public-domain bypass is a single Authelia `access_control`
rule scoped to `resources: ^/api/v1(/.*)?$` with `policy: bypass`, ordered
**above** the host's catch-all. Everything else (including `/api/avatars` and
`/admin`) keeps its existing policy. `REQUIRE_LOGIN` + `SESSION_SECRET` stay set.
**Reason:** `/api/v1` self-authenticates every request (bearer on all routes
except the public, rate-limited `/auth/enroll`), so it never relies on Authelia —
exactly the condition that makes a *scoped* bypass safe. Broadening to `^/api/`
would expose the avatar route and any future `/api` route, so the scope is
strict. During build-out the app can instead point at a LAN base URL, avoiding
the proxy entirely.

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

---

## Approving Bible rewards from the phone (mobile admin, no PIN) — v0.248

The web's reward-payout approval lives in Admin → Money behind the PIN
(`approveBibleBase` / `approveBibleMonthAll` over `pendingBibleRewards()`). The
mobile app can't sit behind that PIN — the device token already establishes who
the person is — so a **parent admin (`person.role === "ADMIN"`) can approve from
the app** with no PIN. The two approval actions were split into session-free
cores in `lib/bible-rewards.ts` (`approveBibleBaseCore`,
`approveBibleMonthAllCore`, plus the moved `postReward`); the web actions and the
new device routes both delegate, so eligibility is re-checked server-side in one
place and a stale client can't force a payout. Same pattern as the add-entry core
(`lib/money-core.ts`), shared by the web action and `POST /money/entry`.

What stays web-admin-only (behind the PIN), by choice: approving/unapproving a
*filed* transaction, editing/deleting a row, setting starting funds, and CSV
import. The app mirrors the read-only `/money` page plus reward approval; those
management actions weren't requested for the phone.

---

## Money admin parity on the phone, minus import (v0.249)

The app now does everything the web Money admin (`/admin/money`, PIN-gated) does
except the one-time CSV import: approve / unapprove / approve-all, edit, delete,
and set starting funds — plus the Bible-reward payout approvals from v0.248. All
of it is admin-device-only: the route checks `person.role === "ADMIN"`, which
replaces the PIN because the device token already proves the parent. **The shared
web wall tablet keeps the PIN** — it's identity-free, so approval there still goes
through `/admin/money`; the app never exposes these on a non-admin device.

Every mutation is a session-free core in `lib/money-core.ts`
(`approveMoneyEntryCore`, `unapproveMoneyEntryCore`, `approveAllMoneyCore`,
`updateMoneyEntryCore`, `deleteMoneyEntryCore`, `setStartingFundsCore`) shared by
the web action and the device route, so validation/eligibility live in one place.
The home dashboard read carries admin-only `money: { pendingApprovals, rewardMonths }`
counts that drive the amber reminder banner (mirrors the web `MoneyReminder`);
Review opens Money rather than approving inline.

Still web-admin only, by choice: **CSV import** (a one-time setup task) and the
**Bible reward-settings config** (per-person opt-in/amounts, bonus, grace — a
set-once form). Both are named in ROADMAP; ask to bring either to the phone.

## Reading — leisure book-tracker (v0.250)
Strictly **self-only**, unlike Money: `personalUserId()` narrows the web page to
the signed-in person and every `/api/v1/books` route acts only on the enrolled
person's own books (mutations 403 otherwise). Parents do **not** see a child's
leisure reading here — deliberate.

A book keeps its size in **pages and/or chapters** (at least one; both allowed).
Progress runs on the single `unit`/`length` pair (pages win when both are set),
so leisure reading keeps feeding the Scholar stat unchanged.

Reading tracks a **current position** (`Book.position`, the page/chapter you're
up to). How far you've read (`read = min(position, length)`) and the Scholar XP
**derive from it at read time** — there is no per-day amount log anymore. Because
scoring is a function of the single current value (never a running sum), setting
the page back and forth can't bank extra credit: each page counts once. Marking
finished sets `position = length` (100%) and un-shelves. The old per-day `BookLog`
rows are unused now (migration 76 backfilled `position` from their sum); the table
is left in place (non-destructive).

**Bookmark was removed** (v0.250.2) as functionally redundant with Shelve — both
just moved a book to the shelf and both kept progress, so it was a second label
for one capability. The shelf is now **To read** (shelved) and **Read** (finished);
a shelved book shows where you left off and resumes there. The `bookmarked` column
is left in the DB unused rather than dropped. Operations live in session-free
`books-core.ts`, shared by the web actions (Authelia session) and the device
routes (bearer token) — same core/auth-at-the-caller split as Money.

## Groceries — device API (v0.251)
Groceries was built web-first long ago (shared list, stores, catalog, per-store
trips). To reach it from the app, the seven shopping operations moved out of the
`"use server"` actions into a session-free `groceries-core.ts`; the web actions
and the new device routes both delegate to it, so **web and app run the exact
same rules** (no drift). The shopping list is **shared family data** — the device
routes are device-authed but not self-only; any enrolled device may read and
write it, matching the web's "anyone can say we're out of milk". Store membership
follows the catalog (`GroceryItem.defaultStoreId`): a typed name that matches a
catalog entry defaults to that store; a new item's store is remembered on first
add. `trip/start` defaults the shopper to the enrolled person (it's their phone).
Store/catalog editing (admin) stays web-only — deferred, like Money's CSV import.

## workout-log.ts: explicit types for logged-set lookups (0.258.0)
The three non-noise type errors in src/lib/queries/workout-log.ts came from
Prisma-projected rows degrading to `{}` when the generated client isn't resolved
(sandbox). Fixed by typing the two lookup Maps explicitly (a shared `LoggedSet`
type; the first Map uses `Pick<LoggedSet,"weight"|"reps">`) and casting the
projected rows, which the selects back at runtime. valueForMetric now takes
`LoggedSet`. Remaining workout-log.ts noise is only the `@/generated/prisma`
type import + implicit-any params — the accepted baseline.

## Admin Tasks page + School assignment editing (0.275.0)
Admin > Tasks (/admin/tasks): server page loads all Category.OTHER tasks for active
users; TasksAdmin client has one pencil (top-left) toggling a whole-list edit mode.
In edit mode each row gets inline edit (title, due date, reassign person) + delete.
New action editTask({id,title,dueDate,userId?}) in actions/tasks.ts (reassign needs
requireCanActFor on the new owner too); deleteTask now also revalidates /admin/tasks.
Admin > School: assignments/tests are now editable, not just deletable. New action
editSchoolWork({id,title,type,subject,classId,dueDate}) updates the Task + its
SchoolWork detail; classId validated against ClassMember like add. school-admin ItemRow
gained a pencil -> inline EditForm (title, type, class-or-subject, due). Added classId
to SchoolItem query/type so the edit form pre-fills the class. No migration (selects an
existing column; edits existing rows). Next: app Settings menu.

## Web: Appearance / themes (0.276.0) - Phase 2b (household, admin-set)
Tailwind v4 @theme tokens are var()-backed, so themes = CSS overrides of the colour
variables. globals.css: added --color-on-accent (white default); html[data-theme="X"]
overrides --color-accent + --color-sidebar (light); html.dark flips neutrals (ground/
surface/ink/muted/hairline/shade) + brightens accent + darkens on-accent; html.dark
[data-theme="X"] per-scheme dark accent/sidebar/on-accent. Same 8 schemes + exact hexes
as the app for parity. Web is token-based (2175 semantic classes vs ~153 raw), so dark
mode is comprehensive; the one fix was accent buttons: migrated `text-white` ->
`text-on-accent` on every line that also had `bg-accent` (114 occ / 76 files, verified no
false positives against bg-black/ink). settings.ts: APPEARANCE_THEME/APPEARANCE_DARK +
getAppearance(); layout applies data-theme + .dark to <html> (force-dynamic already).
actions/settings.ts: setAppearanceTheme/setAppearanceDark (requireAdmin, revalidate layout).
New /admin/appearance page + tile (PaletteIcon). No migration (appSetting rows). Theme is
household-wide by decision; app theme stays per-device. Next epic items: profile (device
endpoints) + notifications.

## Web 0.276.1: server-only fix for the appearance client
0.276.0 failed the Docker build: appearance-admin.tsx (a "use client" component)
imported THEME_NAMES/THEME_LABEL as VALUES from settings.ts, which starts with
`import "server-only"` -> webpack error. (Pre-existing client imports of settings.ts
are `import type` only, which are erased, so they were fine.) Fix: moved the client-safe
constants to a new src/lib/themes.ts (THEME_NAMES, ThemeName, THEME_LABEL, THEME_SWATCH);
settings.ts + actions/settings.ts + appearance-admin.tsx import from there. Reconfirms the
standing rule: never import a server-only module's VALUES into a client component. This is
the class of bug only the Docker build catches.

## Web 0.276.2 + app 0.116.0: profile colour (ring) + toggle fix
Toggle: the dark-mode switch used absolute+translate with no explicit left, so the knob
drifted right / off-frame. Rebuilt with the reliable inline-flex + items-center pattern
(knob translate-x-0.5 off / translate-x-[22px] on, bg-white). Profile colour: new device
endpoint POST /api/v1/me/color sets the enrolled person's user.color (hex, validated) and
revalidates web paths - same field the web profile edits, so it flows to calendar + ring +
everywhere. App: ProfileScreen (settings) with the 8 PERSON_PALETTE swatches + a live ring
preview; setMyColor + refreshPerson (guarded to online so an offline save doesn't revert the
ring from cached me()). Profile is now navigable in Settings. Photo + framing (avatar upload +
pan/zoom cropper producing "tx ty scale") is the next profile phase - bigger Android build.

## Web 0.276.3 + app 0.117.0: finish profile (photo + framing, custom colour)
Web: new POST /api/v1/me/avatar (multipart: optional image + "position"). Replicates
profile.ts file-save (UPLOADS dir, 5MB cap, magic-byte check, random filename, unlink old);
image optional so it also re-frames the current photo (position only). App: ProfileScreen
finished - avatar preview now applies avatarPosition (parseXf + graphicsLayer, matches the
rest of the app so it's WYSIWYG); "Change photo" (PickVisualMedia) + "Adjust framing" open a
circular AvatarCropDialog (detectTransformGestures -> tx/ty % + scale, same transform math);
reads bytes off-main-thread and uploads via setAvatar (multipart). Custom colour: HSV
ColorPickerDialog (hue bar + SV square), last custom colour persisted per-device
(SettingsStore.lastCustomColor) and shown as an extra swatch. Text: "User color" +
"Avatar color shared across the platform" (US spelling by decision). PROFILE COMPLETE.
Remaining epic item: notifications.

## Web 0.276.4 + app 0.118.0: notifications - Phase 1 (settings + plumbing)
Notifications is the last epic item and the biggest, so phased. Phase 1 (this): the
config surface + Android plumbing, verifiable via a test notification; Phase 2 (next):
the scheduling engine that actually fires at event times. Web: GET /api/v1/notifications/
meta returns the household event types for the per-type toggles. App: NotifPrefs (per-device,
JSON in DataStore, all OFF by default) - master enabled, scope (MINE/ALL/FAMILY), per-type
{enabled,lead}, birthday {enabled,lead 1day}. Lead options: at start/15m/1h/1d. Notifications
helper: one "calendar_reminders" channel (IMPORTANCE_HIGH, created at MainActivity start),
POST_NOTIFICATIONS permission (manifest + runtime request when the master toggle is turned on),
post() no-ops without permission. ic_notification vector added. NotificationsScreen wired into
Settings. PHASE 2 TODO: web GET /api/v1/notifications/upcoming (events next ~48h + birthdays,
absolute start, type, mine/family flags); app scheduler (WorkManager periodic + AlarmManager
exact alarms + AlarmReceiver + BootReceiver) reading NotifPrefs -> posts event-name reminders.

## Web 0.277.0: per-event reminders foundation (schema + calendar API)
Migration 77_event_reminders (additive, idempotent): Event.reminders Int[] default {},
EventType.defaultReminder Int?. create-event.ts: EventInput.reminders, normalizeReminders
(non-neg whole minutes, <=40320, dedupe, sort, cap 5); create stores it; update stores it
only when the client sends it (undefined = leave unchanged). Device calendar event
create+update routes parse reminders[]. calendar.ts: GridEvent.reminders? (optional -
base/real events set it from the included row, synthetic birthday/task events omit it),
loadEventTypes + the events include now select defaultReminder. calendar-page.ts: CalEvent.
reminders + toWire + options.eventTypes.defaultReminder. App DTOs: CalEventDto.reminders,
CalEventTypeDto.defaultReminder, Create/UpdateEventRequest.reminders (Delete does NOT).
NEXT (sub-phase 2): app CalendarAddEvent reminder section (Proton-style: Add notification ->
picker, bell+label+X, multiple; new events pre-fill eventType.defaultReminder). Then web
event form + the firing engine.

## Web 0.278.0 + app 0.123.0: notification firing engine
Web: GET /api/v1/notifications/upcoming - events in the next 30 days with non-empty
reminders, scoped to the person (owned/family/participant, non-external, non-cancelled).
Non-recurring included directly; recurring expanded via occurrencesIn() (household tz),
skipping dates a cancelled single-occurrence override removes. Returns {id,title,startMs
(epoch),reminders}; recurring occurrence ids are "parentId:ms".
App engine: NotificationScheduler.refresh() fetches upcoming, computes each reminder's
fire time (startMs - min), schedules exact alarms (AlarmManager.setExactAndAllowWhileIdle,
RTC_WAKEUP; canScheduleExactAlarms guard on 31+, falls back to inexact) via a PendingIntent
to AlarmReceiver (carries title + notifId=code, code = hash("eventId|min")); cancels codes
no longer desired; tracks codes in SettingsStore. Gated by master toggle + POST_NOTIFICATIONS
(clears all if off). AlarmReceiver posts the event name. BootReceiver re-schedules on boot/
package-replace. NotificationWorker (WorkManager, work-runtime-ktx 2.9.1): periodic 2h KEEP
safety net + enqueueOnce. Triggers: MainActivity enqueues periodic+once; AppRoot enqueues
once on every dataRevision (so a calendar edit reschedules). Manifest: USE_EXACT_ALARM (33+)
+ SCHEDULE_EXACT_ALARM (<=32) + RECEIVE_BOOT_COMPLETED + the two receivers. NOTE: offline-
created reminders schedule only after sync (endpoint is server-side). NOTIFICATIONS COMPLETE.

## Web 0.279.0 + app 0.125.0: American spelling + app calendar/settings fixes
Replaced colour->color / Colour->Color across both repos (prose, comments, user-facing
strings; identifiers already used "color"). App-only fixes: (1) Settings Notifications blurb
-> "Reminders, sounds, and vibration settings"; (2) military clock now HH:00 (e.g. 13:00) not
HH; (3) CalendarViewModel.setTab resets date to today + clearPageCaches + navNonce bump, so
switching views always returns to the current day; (4) event editor "Share with" excludes the
owner (editEvent.ownerId, else the current person from session state) and uses KairosIcons.Share
(the workout-share icon) instead of the checklist icon.

## 2026-09 — Security hardening batch (v0.280.0)
From a source review (ChatGPT), verified against the tree before applying:
- **Calendar SSRF.** `syncCalendar` fetched an attacker-influenced subscription
  URL with no address checks and read the whole body unbounded. Fetching now goes
  through `lib/calendar/safe-fetch.ts`: scheme restricted to http(s), the host
  resolved and rejected if any address is loopback/private/link-local/CGNAT/
  reserved, redirects followed manually with each hop re-validated (max 5), and
  the body capped at 5 MB. Residual DNS-rebinding risk is documented in that file
  (only enrolled members can add feeds, so it's a proportionate defence).
- **Auth throttling no longer trusts a spoofable IP alone.** `clientIp` now prefers
  Cloudflare's `cf-connecting-ip` (overwritten by CF, not client-settable), with a
  `REAL_IP_HEADER` override, then XFF as a last resort — and, more importantly,
  every auth endpoint has a *secondary* limit that doesn't depend on IP: login per
  identifier, enroll per code, reauth per device. So rotating source IPs can't
  brute-force one account/code/device past the ceiling.
- **Rate-limit map is bounded** (`MAX_BUCKETS`, expired entries pruned) so varied
  keys can't grow it without bound.
- **API auth is structurally enforced.** `withDeviceAuth(handler)` is the sanctioned
  wrapper for new routes, and `scripts/check-api-auth.mjs` runs in `npm run build`
  (the Docker gate): it fails the build if any `/api/v1` route neither references a
  device guard nor is in the tiny public allowlist (meta, auth/login, auth/enroll).
  Existing routes were left as-is (all already guard); the check prevents a future
  route shipping open.
- **`lastSeenAt` throttled.** `touchDevice` now does a conditional update that writes
  only when the stamp is older than 15 min, so a chatty client doesn't amplify into
  a device write per request.
Not changed: the in-memory limiter stays process-local (single container, fine
behind Cloudflare/Traefik) — bounded now, but not moved to a shared store. The
Nodemailer bump and the false-positive enrollment-code "modulo bias" were left out
deliberately (see the review notes).

## 2026-09 — Nodemailer 7 → 9.1.1 (v0.280.1)
The source review flagged Nodemailer 7.x as carrying advisories; verified against current
sources: 7.x is affected by several (raw-option File Read/SSRF fixed 9.0.1; the *critical*
envelope.size SMTP CRLF injection fixed 8.0.4; jsonTransport/`list` issues fixed 8.0.9).
**Kairos was not exploitable through any of them** — `lib/mail/send.ts` passes only
host/port/auth/tls to `createTransport` and from/to/subject/text/html to `sendMail`: no
custom `envelope`, `raw`, `list`, `jsonTransport`, attachments, or attacker-controlled
addresses, and the only interpolated values (name/link/deviceName) are HTML-escaped.
Bumped to **^9.1.1** (top of the 9.x line — fixes all of the above) rather than 10.x, whose
only breaking change is a Node-20 floor (we run Node 22) with no functional gain and a
TypeScript-migration that could disturb the `@types/nodemailer` setup. 9.1.1 is a plain
drop-in: no code change, `@types/nodemailer ^8.0.1` kept, and nodemailer has zero runtime
deps so the lockfile delta is a single entry. `npm ci` stays valid.

## 2026-09 — Calendar UX, DateField, and workout integrity (v0.318–0.333)

**One `DateField` calendar, no native pickers.** Every `<input type="date">` across
the app was replaced with a single `src/components/date-field.tsx` — a styled popup
calendar (month nav, Today/Clear) so the picker matches the app instead of the
browser's chrome, which isn't CSS-styleable. Drop-in: `name`+`defaultValue` for
uncontrolled form fields, `value`+`onChange` for controlled, plus `min`/`max`/
`disabled`/`wrapperClassName`. All date math is on `YYYY-MM-DD` strings and local
`(y,m,d)` ints — never `new Date(iso)` — to avoid the UTC off-by-one. Outside-click
close uses a **capture-phase `pointerdown`** listener so a click on any element
(even one that stops bubbling) closes it, on touch and mouse.

**One global caret for every `<select>`.** The `.select-caret` rule was broadened to
`select, .select-caret` (unlayered, so it wins over Tailwind utilities) — every
dropdown app-wide gets the same inset chevron with no per-file class; the class is
kept for non-select triggers (the color-picker button).

**Subscribed-event reminders + address.** Migration 88 adds `Event.locationOverride`;
sync never writes it, so a manual address survives feed refreshes, and display/nav
resolve `locationOverride ?? location`. Reminders on external events already survived
refresh (sync doesn't touch `reminders`), so the `/notifications/upcoming` route was
opened to external-with-reminders. The **web** editor for these was then removed:
reminders on subscribed feeds are app-only by design, and the address editor was
dropped (most feeds already carry addresses). The backend (`saveSubscribedExtras`,
migration 88, pipeline) stays for the app to consume later.

**Workout session integrity.** A day can hold several sessions (custom logs each make
their own), but `findOrCreateSession` returned the day's *oldest* session and
`setRestDay`/`logPlannedWorkout`/`logWorkoutSession` mutated it in place — so resting
a day, marking it done, or logging a scheduled/planned workout could overwrite or hide
a real custom log (the oldest). Fixes: `findOrCreateSession` reuses only a day's
bare/scheduled session (null name/category/source); `setRestDay` converts only an
empty placeholder, else adds a separate rest marker; `logPlannedWorkout` reuses its
own plan-named session; `setWorkedOut(false)`'s delete is placeholder-only.

**Duplicate-workout prompt.** Logging a movement/plan already logged that day reports a
conflict (`{name, summary}`) instead of silently duplicating or overwriting; the client
shows "Update or Cancel." Date-scoped (works for backfilled past days). On the app the
log endpoints gate this behind a `detectConflict` flag for back-compat with old clients.

**Birthday type switch.** Selecting Birthday forces all-day + yearly; switching to a
non-birthday type now undoes them (web `chooseKind`, app kind selector) so an event
doesn't stay locked as all-day/annual.

## Game-time monitoring (Sep 2026)

The allowance/token model was retired; Game time is now automatic monitoring fed
by a standalone collector container. Source-side design lives in the collector
repo's DECISIONS.md — this covers the Kairos side.

- **Ingest is a service-token route.** `POST /api/v1/game-time/ingest` is authed
  by `GAMETIME_INGEST_TOKEN` (Bearer or `X-Ingest-Token`), not device auth — the
  only external-ingest auth in the app. It's allowlisted in
  `scripts/check-api-auth.mjs` (the build gate that requires every `/api/v1`
  route to be device-authed or explicitly public).
- **Idempotent + authoritative per day.** `GameDay` is upsert-**replace** (not
  increment) on `(userId, date)`, so the collector re-sending "today so far"
  every 5 min never accumulates. The day's `GameDayTitle` breakdown is
  delete-then-insert, so a corrected push clears stale games. (A collector bug
  that inflated a kid to ~6h was purely the collector including a bogus
  in-memory session — Kairos was replacing correctly.)
- **Data model:** `GameDay` (per person/day total), `GameDayTitle` (per
  person/day/game), `PlayerCard` (current gamerscore / gamerpic / hasGamePass /
  msBalance / platforms). Identity resolved by gamertag → steamId → name.
- **Device route for the app.** `GET /api/v1/game-time` returns the same rows as
  the web page, scoped by the enrolled person: a PARENT sees the household, a
  child sees only themselves. The app decides list-vs-detail from the count.
- **Weekly chart data is already stored** (`GameDay` per date), so the Sun–Sat
  bar chart needs no new backend — the query widens its fetch to cover the week
  even at a month boundary.
- **Per-system icon** comes from `PlayerCard.platforms` (comma-joined), set by
  the collector; the web/app just render Xbox/Steam logos.

## Sept 23–24 2026 run (web v0.458–0.483)

- **Reading goals.** New `ReadingGoal` model on `Book` (migration 107); each goal
  stores `startPage` (migration 108) so progress is measured across the goal's own
  segment `[startPage, target]`, not from page 1. `startPage` = the previous goal's
  target, or the reader's position when the first goal was set (captured in
  `syncBookGoals`, kept stable across edits). `loadReadingProgress` picks the active
  goal (earliest whose due date is today-or-later, else the last) and returns a pct
  that goes negative when you've fallen behind. Surfaced in a "Book reading" section
  on the person page and in the dashboard payload for the app home. Endpoints:
  `/api/v1/books/goals`, goals folded into add/update; `/api/v1/settings/reading-reminder`.
- **Workout overdue.** Root cause of vanishing scheduled lifts: `confirmSportCore`
  marked the day's binary EXERCISE task COMPLETE, so `loadOverdueWorkoutDays` (which
  only looked at PENDING) dropped it. Fixed by including COMPLETE tasks and filtering
  on whether the scheduled workout's exercises were actually logged. Generator now
  backfills `WORKOUT_OVERDUE_MAX` days internally. Dashboard exposes `workoutOverdue`.
- **Companions.** Growth is clean-days-since-acquired (`stageFromGrowth`); egg rarity
  is streak-driven (`luckFromStreak`) with a pity timer. **Egg cap raised 2→3 per
  month**; added `eggCapped` to the companion payload so a full-but-capped egg shows
  "hatch next month" instead of a dead full bar.
- **School catch-up note — ROOT CAUSE FOUND + FIXED (app).** The app has TWO
  school progress renderers: `SchoolScreen.ProgressRow` (has the "Do N a day…" note)
  and `HomeScreen.SchoolProgressRow` (the home school-detail view — the one users
  actually see). A refactor moved the detail to the home screen and never carried the
  note across, so behind subjects showed the orange finish date with no note. Fixed by
  adding the note to `HomeScreen.SchoolProgressRow` (app v0.288). The pace math and the
  web were always correct; the earlier "past spring term" theory was fabricated and
  reverted (first school year — impossible). Lesson: when a UI element "disappears,"
  find WHICH renderer draws the screen in the screenshot before touching the data path.
- **Subject colours are consistent per subject (web v0.484).** Class colours were manual
  (null by default → grey card dots) while the admin overlay assigned palette colours
  per student, by order — so a student missing a subject shifted everyone's colour.
  New `loadSubjectColors()` keys `CLASS_PALETTE` to the GLOBAL subject order
  (sortOrder, createdAt, name), so a subject is one fixed colour everywhere. Used by
  both `loadSchoolProgress` (card dots) and `loadStudentBars` (admin overlay); a manual
  class colour still wins.
- **School catch-up note — (was) OPEN.** The "Do N a day…" pace note
  stopped showing for behind subjects. A first theory (a past-year spring term skewing
  `targetISO`) was wrong and reverted — this is year one, so there is no past spring
  term. Verified the pace math is internally consistent: for a far-off target, any
  subject projected past `targetISO` (orange) also gets a non-null `catchUp`, so the
  computation is not the break. Remaining suspects: delivery (running server/app not
  carrying `catchUpRate`) or the subjects computing as on-track. Needs the live
  per-subject values (onTrack / finishISO / catchUp) to localize before any fix.
- **Monthly framing.** "Season" → "This month" across UI; scoring-start and
  days-to-finish controls moved to the admin "Scoring & rewards" page (off kid-reachable
  pages).

## Sept 24 2026 — base-subject colours (web v0.486)

- School colours key to a BASE SUBJECT, not the granular subject. Subject gained a
  nullable `baseSubject` (migration 109), and `loadSubjectColors` groups subjects by
  `baseSubject ?? name`, assigning one palette colour per group in first-appearance
  order. So Geometry + Pre-Algebra (both Math) share a colour everywhere: card dots,
  app home card, progress page, admin year-calendar overlay. Initial mapping baked into
  the migration (Math, Science, Foreign Language, History, Writing). Grammar/Writing/
  Handwriting currently share the Writing colour; per-subject override + an admin editor
  to set base subjects are the next step (owner: "use my mapping now, admin later").

## Sept 24 2026 — subject-colour admin editor (web v0.487)

- Added a per-subject colour OVERRIDE (Subject.color, migration 110) that wins over
  the base-subject group colour, and a "Subject colours" admin panel
  (school-structure.tsx) to set each subject's baseSubject + colour. Server action
  setSubjectMeta. loadSubjectColors resolves override ?? group colour, so all four
  surfaces update. This is the self-serve replacement for the baked-in migration-109
  mapping; that mapping stays as the seed.

## Sept 24 2026 — base subjects are first-class (web v0.491)

- Base subjects became a real table (BaseSubject: name, colour, sortOrder; migration 111)
  and Subject.baseSubjectId FK. Migration builds a BaseSubject per existing base string
  and per ungrouped subject, then links every subject. loadSubjectColors/loadBaseSubjectColors
  resolve a subject's colour from its base (base.color, else palette by base order).
  loadSubjectGroups feeds the admin editor. Legacy Subject.baseSubject/color columns kept
  but unused; setSubjectMeta retired in favour of group actions (createBaseSubject,
  renameBaseSubject, setBaseSubjectColor, deleteBaseSubject [empty only], assignSubjectToBase,
  promoteSubject). Editor: header-based, edit-mode toggle, HTML5 drag subject->group, promote,
  colour swatches per group. New subjects auto-create their own base.

## Sept 24 2026 — subject IS the colour group; classes are members (web v0.492)

- Collapsed to 2 levels: SUBJECT = colour group/header (colour on Subject.color,
  else palette by subject order), CLASS (SchoolClass) = member, grouped by subjectId.
  BaseSubject retired (table left in place, unused; migration 112 seeds Subject.color
  from base colours). loadSubjectColors back to subject-level; loadSubjectGroups returns
  subjects + distinct class names + an Unassigned bucket. New actions: assignClassToSubject
  (updateMany by class name — moves for all students), promoteClass (own subject),
  setSubjectColor, renameSubjectGroup (header only, does NOT rename classes),
  createSubjectGroup, deleteSubjectGroup (empty only). Editor: subjects as headers,
  draggable class rows (grip), promote, colour swatches per subject. Note: colours can
  shift vs the base-subject era because grouping changed base-order -> subject-order.

## Sept 24 2026 — colour consistency + feed default length (web v0.493)

- School surfaces (loadSchoolProgress, loadSchoolMetrics, loadStudentBars) now colour a
  class purely by its subject (subjectColors.get(subject.name)); the legacy class.color
  preference is dropped so cards match the subject-colours editor. class.color rows remain
  in the DB, just no longer drive display.
- ExternalCalendar.defaultDurationMin (migration 113): the length given to a feed event
  with no DTEND/DURATION (was hardcoded 60 in ics.ts). Threaded parseIcs -> buildEvent;
  sync passes calendar.defaultDurationMin ?? 60. Editable per feed in edit mode
  (setCalendarDefaultDuration, which re-syncs so existing events update).

## Sept 24 2026 — feed force-duration (web v0.494)

- ExternalCalendar.forceDuration (migration 114): when on, defaultDurationMin overrides
  every timed feed event's own end (for feeds publishing a wrong/short end). Threaded
  through parseIcs/buildEvent; sync passes calendar.forceDuration. Toggle in the feed
  edit mode (setCalendarForceDuration, re-syncs). Sandbox note: could not fetch the
  DigitalShift feed to confirm whether it sends DTEND (egress allowlist blocks
  digitalshift.ca; web_fetch refused the constructed URL) — shipped force-length so
  it works regardless.
