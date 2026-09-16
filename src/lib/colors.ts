// Type-only: a value import here would pull the Prisma runtime into any
// client component that needs these labels.
import type { Category } from "@/generated/prisma/client";

/**
 * Two coloring modes for the calendar, as specified:
 *
 *  - No filter (everyone shown)  -> color by PERSON  (User.color, editable per user)
 *  - Filtered to one person      -> color by CATEGORY (below, fixed for all users)
 *
 * Category colors are deliberately not in the database. They must be identical
 * for every person, so making them editable per-row invites drift.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  SCHOOL:      "#4f46e5",
  WORK:        "#7c3aed",
  APPOINTMENT: "#2563eb",
  CHORE:       "#d97706",
  EXERCISE:    "#dc2626",
  BIBLE:       "#7c3aed",
  OTHER:       "#64748b",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  SCHOOL:      "School",
  WORK:        "Work",
  APPOINTMENT: "Events",
  CHORE:       "Chores",
  EXERCISE:    "Workouts",
  BIBLE:       "Bible Reading",
  OTHER:       "Tasks",
};

/** Completion states on the overview cards. */
export const STATUS_COLORS = {
  complete:   "#059669",
  partial:    "#d97706",
  incomplete: "#dc2626",
  overdue:    "#b91c1c",
  none:       "#94a3b8", // nothing assigned; render neutral, not red
} as const;

/** Display order for category sections and tiles on a person's day. */
export const CATEGORY_ORDER: Category[] = [
  "CHORE",
  "SCHOOL",
  "BIBLE",
  "EXERCISE",
  "WORK",
  "APPOINTMENT",
  "OTHER",
];
