// Client-safe theme constants. Kept out of settings.ts (which is server-only,
// pulling in Prisma) so client components — like the admin Appearance picker —
// can import the names, labels, and swatches without dragging server code in.

export const THEME_NAMES = [
  "teal",
  "olive",
  "green",
  "blue",
  "purple",
  "pink",
  "orange",
  "red",
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_LABEL: Record<ThemeName, string> = {
  teal: "Teal",
  olive: "Olive drab",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  orange: "Orange",
  red: "Red",
};

/** The light-mode accent for each theme, for the picker swatches. */
export const THEME_SWATCH: Record<ThemeName, string> = {
  teal: "#0f5c63",
  olive: "#5a6b2f",
  green: "#2e7d32",
  blue: "#1e5fa8",
  purple: "#6b3fa0",
  pink: "#b83280",
  orange: "#c2570c",
  red: "#b3261e",
};
