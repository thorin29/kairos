/**
 * Bumped with every set of changes handed over, so a deployed instance can be
 * checked against what it was meant to receive. The migration list is the
 * quickest tell for a partial upload: a missing file usually shows up as a
 * missing migration.
 */
export const APP_VERSION = "0.74.0";

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
] as const;

export type Change = { version: string; summary: string[] };

export const CHANGES: Change[] = [
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
