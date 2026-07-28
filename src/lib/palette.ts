/**
 * Assigned in order as people are added, so each person gets a distinct
 * calendar color without anyone having to pick one during setup.
 * Chosen for separation at small sizes on a light background.
 */
export const PERSON_PALETTE = [
  "#2563eb",
  "#db2777",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#c2410c",
  "#4d7c0f",
] as const;

export function nextColor(taken: string[]): string {
  return (
    PERSON_PALETTE.find((c) => !taken.includes(c)) ??
    PERSON_PALETTE[taken.length % PERSON_PALETTE.length]
  );
}

/**
 * Colour options for the shared "Family" calendar identity (birthdays, and —
 * later — family events and holidays). The first is the default and matches
 * the app accent.
 */
export const FAMILY_PALETTE = [
  "#0f5c63", // teal (accent, default)
  "#334155", // slate
  "#b91c1c", // red
  "#a16207", // gold
  "#6d28d9", // purple
  "#be185d", // pink
  "#15803d", // green
  "#1d4ed8", // blue
] as const;

export const DEFAULT_FAMILY_COLOR = FAMILY_PALETTE[0];
