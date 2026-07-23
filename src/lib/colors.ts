import { Category } from "@prisma/client";

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
  SCHOOL:      "#2563eb",
  WORK:        "#7c3aed",
  APPOINTMENT: "#db2777",
  CHORE:       "#d97706",
  EXERCISE:    "#059669",
  BIBLE:       "#0891b2",
  OTHER:       "#64748b",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  SCHOOL:      "School",
  WORK:        "Work",
  APPOINTMENT: "Appointments",
  CHORE:       "Chores",
  EXERCISE:    "Exercise",
  BIBLE:       "Bible Reading",
  OTHER:       "Other",
};

/** Completion states on the overview cards. */
export const STATUS_COLORS = {
  complete:   "#059669",
  partial:    "#d97706",
  incomplete: "#dc2626",
  overdue:    "#b91c1c",
  none:       "#94a3b8", // nothing assigned; render neutral, not red
} as const;
