/**
 * Pure calendar view constants and types — no server imports, so client
 * components (the options drawer) can import these without pulling in the
 * server-only prefs module. `prefs.ts` re-exports these for server callers.
 */

export type CalView = "month" | "week" | "three_day" | "day" | "agenda";

export const CAL_VIEWS: CalView[] = [
  "month",
  "week",
  "three_day",
  "day",
  "agenda",
];

export const CAL_VIEW_LABELS: Record<CalView, string> = {
  month: "Month",
  week: "Week",
  three_day: "3 days",
  day: "Day",
  agenda: "Agenda",
};

export type OthersMode = "own" | "grey" | "family";
