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
 * Color options for the shared "Family" calendar identity (birthdays, and —
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

/**
 * Distinct colors auto-assigned to a student's classes on import, so each of a
 * student's classes reads as its own color on the year calendar. Deliberately
 * excludes reds (reserved for "past term end") and ambers/oranges (holiday and
 * vacation markers), so a class colour never blends into those.
 */
export const CLASS_PALETTE = [
  "#2563eb", // blue
  "#0d9488", // teal
  "#7c3aed", // purple
  "#059669", // green
  "#0891b2", // cyan
  "#c026d3", // fuchsia
  "#db2777", // pink
  "#4d7c0f", // olive
  "#0284c7", // sky
  "#6d28d9", // violet
] as const;

/**
 * First class-palette color not already used by this student's other classes,
 * and not one of the reserved calendar colors passed in. Falls back to cycling
 * through the palette once every option is taken. Colors are per student, so two
 * different students may share a color — only same-student clashes are avoided.
 */
export function pickClassColor(taken: string[], reserved: string[] = []): string {
  const blocked = new Set(
    [...taken, ...reserved].map((c) => c.toLowerCase()),
  );
  return (
    CLASS_PALETTE.find((c) => !blocked.has(c.toLowerCase())) ??
    CLASS_PALETTE[taken.length % CLASS_PALETTE.length]
  );
}

/** A valid 6-digit hex color like #1d4ed8 — for custom color inputs. */
export function isHexColor(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s.trim());
}
