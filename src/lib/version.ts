/**
 * Bumped with every set of changes handed over, so a deployed instance can be
 * checked against what it was meant to receive. The migration list is the
 * quickest tell for a partial upload: a missing file usually shows up as a
 * missing migration.
 */
export const APP_VERSION = "0.53.0";

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
] as const;

export type Change = { version: string; summary: string[] };

export const CHANGES: Change[] = [
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
