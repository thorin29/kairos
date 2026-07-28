/**
 * Bumped with every set of changes handed over, so a deployed instance can be
 * checked against what it was meant to receive. The migration list is the
 * quickest tell for a partial upload: a missing file usually shows up as a
 * missing migration.
 */
export const APP_VERSION = "0.27.1";

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
] as const;

export type Change = { version: string; summary: string[] };

export const CHANGES: Change[] = [
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
