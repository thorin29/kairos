/**
 * Bumped with every set of changes handed over, so a deployed instance can be
 * checked against what it was meant to receive. The migration list is the
 * quickest tell for a partial upload: a missing file usually shows up as a
 * missing migration.
 */
export const APP_VERSION = "0.12.0";

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
] as const;

export type Change = { version: string; summary: string[] };

export const CHANGES: Change[] = [
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
