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
