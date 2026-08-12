/**
 * Bumped with every set of changes handed over, so a deployed instance can be
 * checked against what it was meant to receive. The migration list is the
 * quickest tell for a partial upload: a missing file usually shows up as a
 * missing migration.
 */
export const APP_VERSION = "0.97.0";

export const MIGRATIONS = [
  "0_init",
  "1_chores",
  "2_expiry_by_succession",
  "3_settings",
  "4_open_tasks",
  "5_pool_chores",
  "6_birthday",
  "7_event_recurrence",
  "8_game_time",
  "9_reading_plans",
  "10_reading_extras_and_completions",
  "11_chapter_completions",
  "12_groceries",
  "13_exercise",
  "14_collaborative_chores",
  "15_workouts",
  "16_chore_effort",
  "17_effort_scale",
  "18_planned_workouts",
  "19_rest_day",
  "20_anytime_chores",
  "21_shared_admin_pin",
  "22_family_events",
  "23_multi_workout_sessions",
  "24_exercise_pool",
  "25_session_pool_ref",
  "26_planned_pool",
  "27_planned_rest",
  "28_workout_type",
  "29_event_types",
  "30_hiit_workouts",
  "31_planned_hiit",
  "32_hiit_share",
  "33_hiit_movement_metrics",
  "34_sport_events",
  "35_accounts",
  "36_user_email",
  "37_sport_skip",
  "38_event_participant",
  "39_event_duration",
  "40_shade_day",
  "41_recurrence_override",
  "42_pause",
  "43_family_calendar",
  "44_hero_wod",
  "45_school_work",
  "46_school_classes",
  "47_school_work_class",
  "48_school_window",
  "49_school_subjects_types",
  "50_class_members",
  "51_school_due_time",
  "52_class_prompts",
] as const;

export type Change = { version: string; summary: string[] };

export const CHANGES: Change[] = [
  {
    version: "0.97.0",
    summary: [
      "Post-class prompt: after a class meeting ends, each student gets a quick check on their dashboard \u2014 did you attend, and was work assigned? If so, name it, pick a type and due date, and it\u2019s added as school work linked to the class. Attendance and work are asked separately (you can miss class and still have work). It\u2019s on by default per class, with an off switch in Admin \u2192 School for classes that never have homework, and it waits until the class has actually ended",
      "The assignment form\u2019s Subject field now picks from your subject pool (with an \u201cOther\u201d option for one-offs), instead of a plain text box",
      "Clearer wording on the \u201cshow only on the due date\u201d option when adding work, so it\u2019s obvious what checking it does",
    ],
  },
  {
    version: "0.96.0",
    summary: [
      "School work on the calendar now uses a small icon per type \u2014 a lined page for homework, a clipboard for assignments, a checked page for tests, a folder for projects",
      "Work due on a day its class meets now rides the class\u2019s calendar block as a badge: one icon per student with something due, so a class plus two students\u2019 homework stays one block instead of three. Each icon drops off as that student finishes. Work with no class (or due on a non-meeting day) still shows as its own marker. All behind the \u201cSchool work\u201d filter",
    ],
  },
  {
    version: "0.95.0",
    summary: [
      "School work on the calendar: a new \u201cSchool work\u201d filter (in the calendar sidebar) drops every pending assignment, test, homework and project onto the calendar by due date, in one shared colour, so a parent can see at a glance how loaded a day is. It\u2019s off by default, keeping the scheduling grid clean until you want the overload view",
      "Assignments can now carry an optional due time \u2014 with one, the item sits as a timed block at that time; without one, it\u2019s an all-day chip",
      "Fixed: a student who shares a class (but isn\u2019t its owner) can now file work under it, matching the shared-class picker added in 0.93.0",
    ],
  },
  {
    version: "0.94.1",
    summary: [
      "The lock button on the School page now jumps straight to the School admin section, not the general admin page",
      "The \u201cstart a new semester\u201d reminder now also rides each admin\u2019s dashboard card, not just the Admin \u2192 School banner. It\u2019s shared: whichever admin sets up the term (or taps \u201cLater\u201d) clears it for both",
    ],
  },
  {
    version: "0.94.0",
    summary: [
      "Semester rollover: once a term has ended and nothing newer is set up, Admin \u2192 School shows a \u201cstart a new semester\u201d prompt \u2014 name the new term, set its dates (pre-filled to follow the last one), and tick which classes to carry over. Reused classes come back with the same subject, type, colour, students and weekly meeting, re-anchored to the new term",
      "The reminder can be snoozed with \u201cRemind me later,\u201d and how often it comes back is adjustable (default every 7 days)",
    ],
  },
  {
    version: "0.93.0",
    summary: [
      "Classes now have real membership: the owner and everyone it\u2019s shared with are members, and any member can file their own assignments and tests under a shared class \u2014 not just the class owner. Shared classes now appear on each member\u2019s card on the School page",
      "A class can be shared even if it has no meeting time (a co-op or independent work with several students), from the \u201cShared with\u201d picker in Admin \u2192 School. Existing shared classes were carried over automatically",
    ],
  },
  {
    version: "0.92.0",
    summary: [
      "Classes now take their name from a reusable Subject pool, managed in Admin \u2192 School like the chore master list \u2014 pick a subject when adding a class, or type a new one and it\u2019s added to the pool. Renaming a subject renames every class using it. Existing class names and subjects were seeded into the pool automatically",
      "Classes can be given a Type (Homeschool, Church, Dual credit\u2026), also a managed pool in Admin \u2192 School and seeded with those three to start. It\u2019s a label for now, shown on the class line \u2014 the groundwork for the term-rollover and post-class prompts coming next",
    ],
  },
  {
    version: "0.91.0",
    summary: [
      "School work now comes in two flavours. By default an assignment or project is a \u201cwindow\u201d: it shows on the dashboard and School tab every day from its start date until it\u2019s checked off, so a week-long project stays put as a reminder. Tick \u201cDue on a specific date (e.g. a test)\u201d and it only appears on the due date",
      "Window work has a start date \u2014 defaults to today, or set it ahead for work assigned early (known now, starts later). Overdue school work keeps showing until it\u2019s done either way",
    ],
  },
  {
    version: "0.90.0",
    summary: [
      "A class meeting can be shared between students. When a class has a meeting time, a \u201cShared with\u201d picker lets you add other students, and the class shows as one block on everyone\u2019s calendar rather than a separate event per kid",
    ],
  },
  {
    version: "0.89.0",
    summary: [
      "Classes can be edited in place now, instead of delete-and-re-add. Hit Edit on a class to change its name, term, colour, or meeting schedule \u2014 the class\u2019s calendar block is updated, created, or removed to match (e.g. clearing the meeting days turns it into independent work and removes the calendar event)",
    ],
  },
  {
    version: "0.88.0",
    summary: [
      "School, phase 3: a read-only progress view on the School page. Per student it shows completed-of-total, how many were on time, and anything overdue, broken down by class \u2014 scoped to a term you pick (it defaults to the term you\u2019re in) or all time. Tracked, not scored",
    ],
  },
  {
    version: "0.87.0",
    summary: [
      "School, phase 2b: assignments and tests can be filed under a class. When adding one, pick the class (or leave it as a free-text subject as before). On the School page each person\u2019s work is grouped by class, with anything unfiled under \u201cOther work\u201d",
    ],
  },
  {
    version: "0.86.0",
    summary: [
      "School, phase 2a: terms and classes. In Admin \u2192 School you can set up terms (a name and date range) and add classes per student. Give a class weekdays and a time and it becomes a recurring class block on the calendar automatically, running to the end of its term",
      "Classes show on the School page under each student, and independent (no-time) classes are supported too \u2014 just leave the meeting days blank",
    ],
  },
  {
    version: "0.85.0",
    summary: [
      "School is now a real section: a School icon in the top navigation opens a shared page showing everyone\u2019s open assignments and tests, with late ones flagged. Tap a person to jump to their day",
      "The School admin tile is live \u2014 it opened nothing before because it was still marked \u201cnot built yet.\u201d It now goes to the School admin page",
    ],
  },
  {
    version: "0.84.0",
    summary: [
      "School, phase one: assignments and tests. A student can add their own from their day (\u201cAdd assignment or test\u201d), and a parent can add for anyone from the new Admin \u2192 School page. Each has a subject, a type (homework / assignment / test / project), and a due date",
      "School work shows on the daily page and as a School line on the dashboard card, but is tracked-only for now \u2014 it stays out of the score until scoring is reworked. Timed classes still live on the calendar",
    ],
  },
  {
    version: "0.83.0",
    summary: [
      "Runs can be logged in meters as well as miles — handy for track work (400s, 800s). Pick Distance or Meters when logging a run",
      "Named (HIIT/CrossFit) workouts now have an Instructions field. Type out how the workout goes when building it in admin, and Browse shows those instructions instead of the raw movement list",
      "Browse workouts now splits into two tabs — Workouts and Hero WODs — so you can jump straight to the benchmarks",
    ],
  },
  {
    version: "0.82.0",
    summary: [
      "Named (HIIT/CrossFit) workouts can now be fully edited from Admin \u2192 Workouts \u2014 name, type, cap/pyramid, movements, and the Hero WOD flag \u2014 not just deleted. Hit Edit on any workout to load it into the builder",
      "In the log picker, named workouts are grouped as Personal, Shared, and Hero WOD (Hero WODs now have their own section). The HIIT category now reads \u201cHIIT/CrossFit\u201d when choosing a type",
    ],
  },
  {
    version: "0.81.0",
    summary: [
      "Named workouts can be flagged as a Hero WOD (the CrossFit benchmarks named for the fallen, like Kalsu). Set it with a checkbox when building a workout in Admin \u2192 Workouts, or toggle it on an existing one from the list. Flagged workouts show a Hero WOD badge in Browse",
    ],
  },
  {
    version: "0.80.0",
    summary: [
      "New \u201cBrowse workouts\u201d button on a person\u2019s workout card. It lists the named workouts \u2014 HIIT and other multi-part sessions, with their type and movements \u2014 from the shared library plus that person\u2019s own. Simple single movements like push-ups aren\u2019t listed",
    ],
  },
  {
    version: "0.79.0",
    summary: [
      "Tapping a workout on someone\u2019s dashboard now opens the full log pop-up \u2014 the same one as the Workouts page \u2014 instead of a plain checkbox. You can complete the day\u2019s scheduled workout with its tracked metrics, or log a one-off run, game, or lift",
      "A workout carried over from an earlier day logs against that day: tapping yesterday\u2019s missed workout opens it as yesterday\u2019s, so it\u2019s recorded on the day it belonged to and clears off the card",
    ],
  },
  {
    version: "0.78.1",
    summary: [
      "Bible reading is now fully excluded from vacation pauses. A leftover piece of the pause was still keeping reading off the board during a break; reading now always shows and counts as usual, pause or not",
    ],
  },
  {
    version: "0.78.0",
    summary: [
      "A vacation pause now fully clears the main dashboard: past-due chores that were sitting on a person\u2019s card during a break are cleared away too, not just the days still ahead. Each person\u2019s card shows a \u201cPaused for <trip>\u201d note while you\u2019re away, and their page shows a matching banner. Bible reading keeps going through a break",
    ],
  },
  {
    version: "0.77.0",
    summary: [
      "A vacation pause now covers every kind of chore, not just the scheduled weekday ones. \u201cDo anytime\u201d chores and shared (pool) chores step aside for the break too \u2014 nothing shows as due while you\u2019re away, and they pick back up the day after the pause ends",
      "The Chores page shows a note at the top while a pause is on, so it\u2019s clear why the board is quiet \u2014 the same idea as the paused note on the workout cards",
    ],
  },
  {
    version: "0.76.0",
    summary: [
      "A vacation pause now pauses workouts too. For every day a pause covers, nobody gets a workout prompt \u2014 the plan steps aside and nothing shows as due or overdue \u2014 and workouts resume the day after the break ends. You can still log a session during a break if you want it on the record; it just won\u2019t be asked of you",
    ],
  },
  {
    version: "0.75.0",
    summary: [
      "A workout on the dashboard now shows the name of the day\u2019s workout from the plan (e.g. \u201cLeg day\u201d) instead of a plain \u201cWorkout\u201d, with \u201cWorkouts\u201d still underneath as the category. Days set up with only a single scheduled exercise, and no named plan, keep the plain label",
      "Missed workouts now expire like chores do. Set how long one stays overdue in Admin \u2192 Workouts \u2014 anywhere from the day after it was due up to \u201cUntil next due\u201d, which keeps it until the same weekday\u2019s workout comes round again. Defaults to \u201cUntil next due\u201d. An expired workout greys out, stops counting, and drops off \u201cCarried over\u201d",
    ],
  },
  {
    version: "0.74.0",
    summary: [
      "A weekly event can now repeat on several days of the week \u2014 pick \u201cWeekly\u201d and tap the days (e.g. Monday and Wednesday for a twice-a-week practice). It defaults to the day the event starts on",
      "Removed \u201cOther\u201d from the event type list; if you ever need it, add it as a custom type in Admin \u2192 Calendar",
    ],
  },
  {
    version: "0.73.0",
    summary: [
      "A subscribed calendar can now belong to the whole family instead of one person \u2014 pick \u201cFamily (shared)\u201d when adding a feed, and its events show for everyone in the family colour (good for a town or school-wide calendar). Feeds owned by a person still take that person's colour",
      "When adding an event, custom types (like a hockey game or a dentist appointment) now sit in the same Type list as the built-in ones instead of under a separate \u201cCustom\u201d heading",
    ],
  },
  {
    version: "0.72.0",
    summary: [
      "The person/family filter now applies to the day view too: it shows a column only for each selected person, and the columns resize to fill the space \u2014 so you can line two people up side by side to compare their days",
      "An event shared by several people (a workout, a shared appointment) now appears in each of their columns, so deselecting one person still leaves it in the other's \u2014 dropping a person removes their copy without hiding the whole event",
      "An event that runs past midnight is now split across the two days instead of being cut off at midnight, so the tail end shows on the next day",
    ],
  },
  {
    version: "0.71.0",
    summary: [
      "Day view now shows a column for each person side by side, headed by their name pill, so you can see everyone's day at once",
      "All-day events (like a vacation) span across the top of all the columns, and shared \u201cFamily\u201d timed events span across every person's column",
      "Tapping a spot in someone's column and adding a new appointment fills in that person as the owner",
    ],
  },
  {
    version: "0.70.0",
    summary: [
      "The calendar has a new side panel: a \u201cNew event\u201d button, a small month calendar you can page through and tap to jump around, and the person/family filters \u2014 which frees up the schedule to show more hours",
      "Clicking the grid now selects the half-hour block you clicked inside (a click at 2:46 gives 2:30\u20133:00), and dragging lengthens it in 15-minute steps without moving the start",
      "Removed the \u201cwhole family's schedule\u201d line at the top",
    ],
  },
  {
    version: "0.69.0",
    summary: [
      "Right-clicking a time block you dragged now keeps that block instead of snapping back to the default length",
      "Grid taps and clicks now snap to the hour or half-hour (:00 / :30) instead of quarter-hours",
      "Vacations & pauses moved from Admin → Chores to Admin → Calendar, where scheduling lives",
    ],
  },
  {
    version: "0.68.0",
    summary: [
      "Adding an event is simpler: tap or click an empty spot and a block of time highlights (30 min by default, set it in Admin → Calendar), then right-click or long-press it and choose \u201cNew appointment.\u201d On a mouse you can drag to make the block longer",
      "All-day events (birthdays, vacations) can now be right-clicked or long-pressed to edit, copy, or delete",
      "Fixed a vacation longer than a week vanishing from the middle weeks — a multi-day event now shows across every week it covers",
      "Fixed this week opening in the afternoon: the current time line stays in view and is what the grid snaps back to",
      "Fixed a long-press highlighting the menu text; hour lines are darker so they read under the day shading; and events have a little more room on the right",
    ],
  },
  {
    version: "0.67.0",
    summary: [
      "New events are now started with a double-click (or double-tap) and drag, so a single click is free to pick an event and no stray selection line flashes on a plain click",
      "On a shaded day, today is drawn a little darker so the current day still stands out during a vacation",
      "Jumping to another week now opens at the morning instead of the afternoon, so you see the start of the day first",
      "Past vacations drop off the Admin → Chores list once they're over (they stay on the calendar); day, week, and month views are now the same height with a bit more room for hours; and the calendar filters are smaller with the divider and \u201cShow\u201d label removed",
    ],
  },
  {
    version: "0.66.0",
    summary: [
      "New in Admin → Chores: pause the household for a vacation or break. Give it a name and a date range and no chores are due for those days — they start again the day after it ends",
      "A pause drops a shaded multi-day event on the calendar so the break is visible, and its days don't count against anyone's score",
      "Multi-day all-day events now show across every day they span, not just the first",
    ],
  },
  {
    version: "0.65.0",
    summary: [
      "Fixed: tapping or clicking an empty spot on the calendar no longer creates an event. A new event now starts only when you drag across a time range (the tap just clears any highlighted event)",
      "Editing a repeating event with \u201call events in the series\u201d chosen now lets you change how it repeats and when it ends, or stop it repeating altogether",
    ],
  },
  {
    version: "0.64.0",
    summary: [
      "A repeating event can now end after a set number of times, not just on a date: the add-event form's \u201cEnds\u201d option offers Never, On a date, or After a number of times",
    ],
  },
  {
    version: "0.63.0",
    summary: [
      "Calendar events can now be edited: long-press (tablet) or right-click (computer) an event and choose Edit to change its name, who it's for, type, time, duration, and details",
      "For a repeating event, editing asks whether to change just that one occurrence or the whole series \u2014 changing one leaves the rest of the series alone",
      "The Edit option replaces the \u201ccoming soon\u201d placeholder in the event menu",
    ],
  },
  {
    version: "0.62.0",
    summary: [
      "Day shading is now decided per event instead of by one global switch: the add-event form has a \u201cShade this day\u201d box for all-day events, and each person\u2019s profile has a \u201cshade this birthday\u201d toggle \u2014 so you can shade immediate family birthdays every year and leave extended family unshaded",
      "When more than one all-day event on the same day is set to shade, the day splits into side-by-side colour bands \u2014 so two shared birthdays can both show, or you can shade just one, or neither",
      "The old global all-day shading switch in Admin \u2192 Calendar has been removed in favour of this per-event control",
    ],
  },
  {
    version: "0.61.0",
    summary: [
      "Birthdays now shade their day too, and there's a new switch in Admin \u2192 Calendar to turn the all-day shading on or off \u2014 when on, any all-day event (a vacation, a birthday, a day off) tints its whole day column in a light wash of its colour",
      "Adding an event now has a Duration picker (15 min up to 3 hours, or a custom end time) instead of only an end time",
      "Custom event types can be given a default length in Admin \u2192 Calendar (e.g. hockey practice = 90 min), and picking that type when adding an event fills the duration in automatically",
    ],
  },
  {
    version: "0.60.0",
    summary: [
      "Calendar events are now interactive: a tap highlights an event, and a long-press (on the tablet) or a right-click (on a computer) opens an action menu",
      "The menu can Copy an event \u2014 it opens the add-event form already filled in as a duplicate, so you drop it on whatever day or time you want \u2014 or Delete it; an Edit option is coming in the next update",
      "On the tablet the calendar now scrolls with two fingers, which leaves a single finger free to pick an event instead of accidentally scrolling",
    ],
  },
  {
    version: "0.59.0",
    summary: [
      "Calendar day/week grid now follows the clock as intended: in the afternoon it opens scrolled to the current time instead of always parking at the morning \u2014 the fix that was silently not firing before",
      "A shared all-day \"Family\" event (like a vacation) now tints its whole day column with a light wash of the family colour, with the event pill still pinned at the top; birthdays don't trigger the wash",
    ],
  },
  {
    version: "0.58.0",
    summary: [
      "A sport-workout event can now include several people: when the event type is a sport workout, the form shows a \"who's going?\" picker, and each person checked gets their own \"did you do it?\" prompt",
      "Each person answers independently per occurrence \u2014 one completing and another declining never affect each other or future days",
      "Leaving the picker empty keeps the old behaviour: just the person the event is for is asked",
    ],
  },
  {
    version: "0.57.0",
    summary: [
      "Sport calendar events no longer auto-log a workout \u2014 instead the person gets a \"did you do it?\" prompt on their dashboard card. Yes logs the workout; No is remembered for that day only",
      "Each occurrence is its own prompt per person: on a recurring practice, one person confirming and another declining don't affect each other, and a decline never carries to future days",
      "Calendar page: removed the redundant day/schedule list that repeated below the calendar grid",
    ],
  },
  {
    version: "0.56.0",
    summary: [
      "Calendar: drag across the day or week grid to pick a time range \\u2014 it highlights as you go, and letting go opens the new-event form pre-filled with that start and end (mouse/trackpad; a tap still adds an event on touch)",
      "Calendar: the person filter avatars moved to the bottom, below the calendar",
      "Calendar page now shows only calendar items \\u2014 the to-do / chore lists were removed (chores live on the Chores page)",
      "Dashboard: open and up-for-grabs chores now sit directly under the person cards instead of at the bottom",
    ],
  },
  {
    version: "0.55.0",
    summary: [
      "Once sign-in is required, the shared-screen actions (checking off tasks, logging workouts, adding groceries and events, and the like) now need a signed-in session too \\u2014 no change when sign-in is off",
      "Names are now treated case-insensitively when adding people, matching how login already works, so \\\"Marco\\\" and \\\"marco\\\" can't both exist",
    ],
  },
  {
    version: "0.54.0",
    summary: [
      "Device modes: Admin \\u2192 Device sets this screen to Shared (the whole household, for the wall tablet) or Personal (just the signed-in person, for a phone). Remembered per device",
      "Require sign-in: a switch in Admin \\u2192 Device that makes every page need a personal login \\u2014 off by default, and it can't be turned on until at least one person has a login",
      "Personal mode shows only your card and hides the household add-task and open-chores sections",
      "Once sign-in is required, editing a profile is limited to that person or an admin (open as before when it isn't)",
    ],
  },
  {
    version: "0.53.1",
    summary: [
      "Replaced the example values in the SMTP settings fields with generic placeholders (no real addresses or hosts in the public code)",
    ],
  },
  {
    version: "0.53.0",
    summary: [
      "Invites can now be emailed: set a person's email in Household \\u2192 Accounts and sending an invite also emails them the link (the copy link stays as a backup)",
      "New Admin \\u2192 Email page to configure an SMTP server (Proton Bridge: STARTTLS, accept self-signed cert, TLS 1.2), with a \\\"Send test email\\\" button that reports the real error",
      "Any SMTP field can instead be set as a container environment variable, which overrides the GUI \\u2014 the page lists which ones are",
      "Sign-in now accepts a name or an email; email is optional (kids without one still sign in by name)",
    ],
  },
  {
    version: "0.52.1",
    summary: [
      "Fixed the Copy button on an invite link doing nothing over plain-HTTP LAN access (the browser only exposes one-click copy on HTTPS) \\u2014 it now falls back so it works either way",
      "The invite link is also a tap-to-select field now, so it can always be copied by hand if a locked-down browser blocks automatic copy",
    ],
  },
  {
    version: "0.52.0",
    summary: [
      "Personal accounts: a parent can give someone a login for their own phone from Household \\u2192 Accounts \\u2014 send a one-time invite link and they set their own password",
      "No self-signup: an account only works after a parent invites it; re-sending an invite is also how a password is reset, and Disable turns a login off",
      "Sign in at /login; a small badge in the bottom-left shows who's signed in, with sign-out. The shared tablet still needs no login and nothing is gated behind it yet",
      "Hardening: repeated wrong admin PIN or password attempts are now rate-limited",
    ],
  },
  {
    version: "0.51.0",
    summary: [
      "Sport calendar events can count as workouts: flag an event type as a sport workout in Admin \u2192 Calendar",
      "An event of that type (a one-off or a recurring practice) auto-logs a SPORT workout for that person on the day \u2014 delete it like any workout if they skipped",
    ],
  },
  {
    version: "0.50.0",
    summary: [
      "Day view is now a time grid like the week, with tap-to-add and the same scrolling",
      "A now-line tracks the current time on the day and week grids (colour set in Admin \u2192 Calendar)",
      "Grids open on the morning's earliest event and follow the clock into the afternoon so evening events come into view; scroll freely and it eases back after a configurable pause",
    ],
  },
  {
    version: "0.49.0",
    summary: [
      "Adding a calendar event is now a pop-up over the calendar, opened from a + at the top",
      "Tap a day/time slot in the week grid to start an event there, with the day and time pre-filled (still editable)",
      "Custom event types can be renamed and recoloured from Admin \u2192 Calendar",
    ],
  },
  {
    version: "0.48.0",
    summary: [
      "New HIIT type: Tabata (20s on / 10s off × 8)",
      "Building a HIIT workout: drag movements up and down to reorder, and the input adapts to the movement — a run asks for distance, a barbell/kettlebell/dumbbell movement asks for reps and weight, everything else asks for reps",
      "Exercise pool items can now be renamed — tap the pencil",
    ],
  },
  {
    version: "0.47.0",
    summary: [
      "Share your own HIIT/CrossFit workout: pick it when logging and tap \"Share with the family\" \u2014 it goes to a parent to approve",
      "Admin \u2192 Workouts shows pending share requests to approve (adds it to the shared pool for everyone) or dismiss",
      "Each person's own HIIT workouts now appear under their name in admin, where you can rename, share, or delete them",
    ],
  },
  {
    version: "0.46.0",
    summary: [
      "Weekly plan: add a named HIIT/CrossFit workout to a day (pick from yours or the shared pool); it carries week to week",
      "On that day it shows up in Today's plan to complete \u2014 log its result and it's done, just like a scheduled lift",
    ],
  },
  {
    version: "0.45.0",
    summary: [
      "Logging a HIIT/CrossFit workout now starts with a workout dropdown \u2014 pick a named workout (yours or shared) and just log its result",
      "\"+ New workout\" sits on top of that dropdown: build one on the fly and it's saved into your own workout pool as you log it",
    ],
  },
  {
    version: "0.44.0",
    summary: [
      "HIIT/CrossFit workout builder in Admin \u2192 Workouts: build named workouts (like \"Cindy\") from your HIIT movement pool",
      "Six workout types \u2014 For time, For reps, AMRAP, Stations, Timed stations, Pyramid \u2014 each with the right config (time cap, seconds per station, pyramid range) and per-movement reps",
      "This is phase 1; next these named workouts become pickable by name when logging and planning",
    ],
  },
  {
    version: "0.43.0",
    summary: [
      "Calendar: \"Kind\" is now \"Type\", and parents can add custom event types from Admin \u2192 Calendar (e.g. Hockey game, Medical appointment), each with its own colour",
      "Events given a custom type show in that type's colour on the calendar",
      "The Family calendar colour now accepts any custom colour, not just the presets",
    ],
  },
  {
    version: "0.42.0",
    summary: [
      "HIIT / CrossFit builder: from \"Log something else\", pick HIIT to name a workout, choose a type (AMRAP / for time / max sets), pull movements from the HIIT pool, and log one result",
      "Results read back naturally — \"AMRAP · 12 rounds\", \"For time · 8:32\", \"Max sets · 60\" — in today's list and history",
    ],
  },
  {
    version: "0.41.0",
    summary: [
      "Plans can now include a rest day: pick \"Rest day\" from the category dropdown to schedule a weekday as rest (no workout prompt is created for it)",
      "The opened person card is a little wider and now matches the layout of the tile — same avatar and a matching row of Plan / Log / Rest actions, so the icons line up as it zooms open",
    ],
  },
  {
    version: "0.40.0",
    summary: [
      "The opened person card now shows their progress graph up top, above the plan/log/rest buttons — a bigger version of the tile",
      "That graph is now pool-based (it reflects logged workouts) and, when a plan is scheduled today, focuses on today's movements",
    ],
  },
  {
    version: "0.39.0",
    summary: [
      "Weights units are now set per muscle group in the pool (lb or kg each), replacing the single global measurement system",
      "Fixed the one-off \"Log something else\" button staying greyed out — it now works the moment you've picked an exercise and entered a result",
      "Logging a planned lift now labels the field \"today's max\" so it's clear what the number is",
      "Progress charts: the legend shows just each person's name and colour; hover a point to see the value and date",
      "Admin: the pool creation form says \"Muscle group\", each group has a lb/kg switch, and opening a person now shows just their logged workouts (with a count on the list) instead of the empty exercise/plan sections",
    ],
  },
  {
    version: "0.38.0",
    summary: [
      "New Compare section on the Workouts page: pick a pool movement and see a line per person of their best-per-day, so the same lift finally charts across everyone",
      "Tap a name in the chart legend to hide or show that person's line",
      "Only movements someone has actually logged appear in the picker",
    ],
  },
  {
    version: "0.37.0",
    summary: [
      "One \"Log workout\" button per person now opens a single sheet: today's scheduled workouts sit at the top, each completed by filling in only the metrics it tracks",
      "Retired the \"Mark done\" toggle and the gear/\"add a lift\" panel — completing a real workout (or logging a one-off) is what marks the day done",
      "\"Log something else\" for one-off pool logging lives in the same sheet, so there's no longer a confusing split between logging weights and logging a workout",
    ],
  },
  {
    version: "0.36.0",
    summary: [
      "Planning a workout now pulls from the shared pool instead of free-typing: pick a category, choose the movements, and mark which ones to log a number for",
      "Weights plans pick a muscle group first; run/row/ruck days need no movements — the day itself is the workout",
      "Each planned movement carries a per-exercise \"log a metric?\" setting, ready for one-tap completion next",
    ],
  },
  {
    version: "0.35.0",
    summary: [
      "Logging a workout now pulls the exercise from the shared pool — pick a type, then choose the movement (Sport → Hockey practice, weights grouped by muscle)",
      "Logged sets are recorded against the pool movement, so the same exercise can line up across people for comparison later",
    ],
  },
  {
    version: "0.34.0",
    summary: [
      "New shared exercise pool: admins build one household-wide library of movements on the Workouts page, with weights grouped by muscle (Chest, Back, Legs…)",
      "Groundwork for picking exercises from the pool when planning and for comparing the same movement across people",
    ],
  },
  {
    version: "0.33.0",
    summary: [
      "Admin can open a person from the Workouts page to see and delete their exercises, weekly plan, and logged workouts — for clearing out test or mistaken records",
    ],
  },
  {
    version: "0.32.0",
    summary: [
      "Delete a workout you logged by mistake — today's from the day's list, and older ones from a new Recent workouts list on each person's card",
    ],
  },
  {
    version: "0.31.0",
    summary: [
      "Log more than one workout a day — a lift and a run, hockey and a ride; each shows in the day's list and can be removed",
      "Adding a workout now picks the metric from the type: running is distance, rowing is meters, rucking is distance with an optional load",
      "New Rucking workout type; a workout's name defaults to its type if you leave it blank",
    ],
  },
  {
    version: "0.30.0",
    summary: [
      "Custom workouts from a card: name a one-off (HIIT, a run, a game…), pick what to record — reps, time, distance, meters, or weight — and log today's result",
      "Reuses a workout of the same name so repeats don't pile up; optionally add it to your progress graph",
    ],
  },
  {
    version: "0.29.0",
    summary: [
      "Workout cards now preview just the action icons (no labels), softly out of focus",
      "Tapping a card zooms it open, growing and pulling into focus from where it was tapped",
    ],
  },
  {
    version: "0.28.0",
    summary: [
      "Workout cards preview Create plan / Log / Rest icons; tap the card to open a larger version where they're active",
      "Admin sub-pages: Close admin and Lock admin now sit together on the right",
    ],
  },
  {
    version: "0.27.2",
    summary: [
      "Logo now shows on the PIN overlay too, and is the favicon / installable app icon",
      "Admin sub-pages: \"Dashboard\" replaced by \"Close admin\" (leaves without locking)",
    ],
  },
  {
    version: "0.27.1",
    summary: [
      "Kairos logo in the top-left of every page and on the unlock screen",
    ],
  },
  {
    version: "0.27.0",
    summary: [
      "Add calendar events for the whole Family, not just a person",
      "Family events always show, in the Family color, like birthdays",
    ],
  },
  {
    version: "0.26.0",
    summary: [
      "Birthdays now always show on the calendar, whatever the filter",
      "Birthdays read \"<name>'s Birthday\" (no age) and use the Family color",
      "The calendar's \"Everyone\" filter is now \"Family\", with its own color",
      "Set the Family color in the Household admin page",
    ],
  },
  {
    version: "0.25.2",
    summary: [
      "Admin-change dialog now has an on-screen number pad and accepts Enter",
    ],
  },
  {
    version: "0.25.1",
    summary: [
      "Changing who is an admin now asks to confirm and, if a PIN is set, to enter it",
      "The last admin can't be demoted or removed \u2014 there's always at least one",
    ],
  },
  {
    version: "0.25.0",
    summary: [
      "One shared admin PIN instead of a PIN per parent (your current PIN is kept)",
      "Admin is now a per-person toggle on the household page; the first person is the admin",
      "Turn the PIN on or off, or change it, from the household page (off needs the current PIN)",
      "With no PIN set, admin is simply open (single-adult homes)",
    ],
  },
  {
    version: "0.24.4",
    summary: [
      "Fixed the PIN overlay lingering and reappearing after unlocking",
      "Lock admin now returns to the matching dashboard (chore admin \u2192 chores, etc.)",
    ],
  },
  {
    version: "0.24.3",
    summary: [
      "Bottom-right lock now shows open when admin is unlocked, closed when locked",
      "Locked with a PIN, it opens the PIN pad as an overlay (with Cancel); unlocked, it goes straight in",
      "Every admin sub-page now has a Lock admin button up top; \"Admin\" is now \"Admin Menu\"",
      "With no PIN set, admin is open (optional PIN)",
    ],
  },
  {
    version: "0.24.2",
    summary: [
      "Admin lock moved to a small icon in the bottom-right of every page",
      "It jumps straight to that page's admin section; top edit buttons removed",
      "PIN pad now accepts a real keyboard as well as taps",
      "Renamed \"Shared chores\" to \"Up for grabs\"; catch-up list moved to the bottom",
    ],
  },
  {
    version: "0.24.1",
    summary: [
      "Anytime chores now appear on the person cards and in the effort table",
      "Effort table counts an anytime chore as a per-week share of its effort",
      "One master lock to lock or unlock every chore's effort at once",
      "Calendar events keep each person's color when filtering (never grey)",
    ],
  },
  {
    version: "0.24.0",
    summary: [
      "New \"Do anytime\" chore: sits on the list all period, done any day, late only at the end",
      "Its \"how often\" sets the period — weekly, every other week, every N weeks — then it resets",
      "Collaborative, shared, and anytime chores are now picked from the master list, not typed in",
    ],
  },
  {
    version: "0.23.0",
    summary: [
      "The calendar avatar (circle + name tag) now used on the dashboard cards",
      "Dashboard cards show the name only in the avatar, and bounce on hover",
      "Workouts cards now share the dashboard card layout and avatars",
      "Everyone filter shows a little person per family member instead of a symbol",
    ],
  },
  {
    version: "0.22.4",
    summary: [
      "Avatars now use one fixed circle whether a photo, icon, or letter — no more shifting when a photo is added",
      "Calendar name tags stay locked in place regardless of avatar type",
      "Profile page no longer jumps when you pick an image",
    ],
  },
  {
    version: "0.22.3",
    summary: [
      "Calendar filters compacted, and every name tag now sits low like the photo ones so more of each circle shows",
    ],
  },
  {
    version: "0.22.2",
    summary: [
      "Calendar filter names shifted right again — text starts at the circle center, spacing kept even",
    ],
  },
  {
    version: "0.22.1",
    summary: ["Fixed a build error in the calendar's people filter"],
  },
  {
    version: "0.22.0",
    summary: [
      "Calendar filters: select several people at once, or none",
      "Unselected people go grayscale so the chosen ones stand out",
      "Caption now names whose schedules are shown (or none)",
      "Even spacing — every filter is the same size regardless of name length",
    ],
  },
  {
    version: "0.21.2",
    summary: [
      "Calendar filter name tags shifted right, aligned to the circle center",
    ],
  },
  {
    version: "0.21.1",
    summary: [
      "Calendar filters: all circles the same size, all name tags aligned",
    ],
  },
  {
    version: "0.21.0",
    summary: [
      "Tapping a workout card now asks: log the plan, log new, or rest/skip",
      "No plan yet? The card leads with creating one first",
      "Cards show what each person is doing today; rest/skip won't count later",
      "Calendar name tags line up with the circle; fixed the gear icon",
    ],
  },
  {
    version: "0.20.0",
    summary: [
      "Workouts laid out like the dashboard; tap a card to open a full view",
      "Build a weekly workout plan — name workouts per day, copy a day across",
      "Chore effort is now a 1-5 scale and can be locked so it isn't nudged",
      "Calendar name tags moved back to the bottom-right",
    ],
  },
  {
    version: "0.19.3",
    summary: [
      "Fixed profile icons not saving — they now stick and show everywhere",
      "Calendar badges: name pill sits in front, dark with white text",
      "Everyone badge now uses the stylized \u2200 (\"for all\") mark",
    ],
  },
  {
    version: "0.19.2",
    summary: [
      "Calendar person filters redesigned — a bigger photo with a small name tag",
      "Filters bounce on hover; \"Everyone\" now sits last and matches the style",
    ],
  },
  {
    version: "0.19.1",
    summary: [
      "Shared chores now have an effort weight too, set and edited like the rest",
    ],
  },
  {
    version: "0.19.0",
    summary: [
      "Chores carry an admin-only effort weight (easy / average / hard)",
      "New effort-balance table shows each person's load by day and week",
      "Highest load each day and for the week is highlighted, to even things out",
      "Renamed \"Who has what\" to \"Assigned chores\"",
    ],
  },
  {
    version: "0.18.0",
    summary: [
      "Workouts reworked into a personal training log",
      "Define your own lifts, schedule them by weekday, pause or end a plan",
      "\"Worked out today?\" is binary on the dashboard; logging completes it",
      "Weightlifting progress graph — a coloured line per lift you can toggle",
      "Admin sets the measurement system; per-exercise units override it",
    ],
  },
  {
    version: "0.17.1",
    summary: [
      "Collaborative chores can start on a date you pick",
      "Renamed Exercise to Workouts",
      "Calendar: bigger profile circles, tidier pills tinted to each person",
      "About moved to the end of the admin panel",
    ],
  },
  {
    version: "0.17.0",
    summary: [
      "Collaborative chores: share one chore across several people",
      "Frequency for collaborative chores — weekly, every other week, every N weeks",
      "Rename a chore in place with the pencil on the master list",
      "Fixed the singular wording when only one chore is unassigned",
    ],
  },
  {
    version: "0.16.1",
    summary: [
      "Fixed the crash when dragging chore cards",
      "Cards now shift out of the way live as you drag, not just on drop",
    ],
  },
  {
    version: "0.16.0",
    summary: [
      "Admin chores: drag person cards to reorder the household",
      "Move a chore to another person or day from a card, via a pop-up",
      "Reordered the page — assign first, cards next, master list at the bottom",
    ],
  },
  {
    version: "0.15.0",
    summary: [
      "Exercise: build routines of movements and assign them per person by weekday",
      "Daily workouts show on the dashboard and count like any other category",
      "Log the sets, reps, and weight you actually did, with a last-time hint",
      "Admin: routines, movements with targets, and a weekday assignment grid",
    ],
  },
  {
    version: "0.14.2",
    summary: [
      "Clearer shopping-cart icon for Groceries",
      "Buttons show the pointer cursor again on desktop",
    ],
  },
  {
    version: "0.14.1",
    summary: [
      "Family reading progress moved to its own page, coloured by genre",
      "Editing chapters is now a pop-up you save or cancel — no more auto-save",
      "Books are shaded dark when complete, lighter when part way through",
    ],
  },
  {
    version: "0.14.0",
    summary: [
      "Groceries: a shared shopping list, filtered by store (Costco, grocery…)",
      "The list learns — common items surface as quick picks with icons",
      "Assign items to a person and check them off into the cart",
      "Admin: manage stores and the remembered catalog",
    ],
  },
  {
    version: "0.13.1",
    summary: [
      "Check off reading by chapter, not just whole books — open a book to tick chapters",
      "Plan progress fills the check-off in automatically as the days pass",
      "Reading cards label each day by its real date again, fixed as you scroll",
      "Admin is reached from an admin person's card; the header gear is gone",
    ],
  },
  {
    version: "0.13.0",
    summary: [
      "Renamed to Kairos",
      "Plan generator: chapters-per-weekday, and a reorderable reading list",
      "Extra one-off readings (Christmas, Easter) that don't count towards coverage",
      "Mark books already read so the coverage percentage reflects where you are",
      "Whole-Bible badge; reading cards label days relative to the one in focus",
      "Fixed: normal pages no longer show admin controls",
    ],
  },
  {
    version: "0.12.0",
    summary: [
      "Bible plan generator: pick books and a pace, dates worked out",
      "Reading deck centres today by layout, not by scrolling",
      "Shared pages opened from admin offer a way back to it",
    ],
  },
  {
    version: "0.11.1",
    summary: ["Architecture notes added"],
  },
  {
    version: "0.11.0",
    summary: [
      "Bible reading shown as a deck of day cards",
      "Calendar feeds moved to the admin area",
      "Top bar no longer wraps on narrow screens",
    ],
  },
  {
    version: "0.10.0",
    summary: [
      "Shared navigation bar on every page, fixed width and position",
      "Calendar header rules and half-hour lines",
      "About page with version and migration check",
    ],
  },
  {
    version: "0.9.0",
    summary: [
      "Bible reading: plan import, draft and publish, coverage statistics",
      "Unlock page moved out of the guarded admin routes",
      "Roadmap added",
    ],
  },
  {
    version: "0.8.0",
    summary: [
      "Game time: daily allowance, weekly tokens, admin limits",
      "Task categories removed; one navigation control per page",
    ],
  },
  {
    version: "0.7.0",
    summary: [
      "Admin area behind a numeric PIN, guarded at the route level",
      "Chores split into a read-only overview and a locked editor",
      "Event recurrence and birthdays as events",
    ],
  },
];
