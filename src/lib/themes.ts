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
  "graphite", // v0.710
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
  graphite: "Graphite",
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
  graphite: "#4f4b46",
};

/** The dark-mode accent for each theme (the picker's swatches in dark mode). */
export const THEME_SWATCH_DARK: Record<ThemeName, string> = {
  teal: "#2dd4bf",
  olive: "#aac066",
  green: "#5bd37a",
  blue: "#6ba6f5",
  purple: "#c08bf5",
  pink: "#f77fbe",
  orange: "#fb9e4b",
  red: "#f48078",
  graphite: "#c9c4bc",
};

// --- Backgrounds (v0.710) ---------------------------------------------------
// The neutrals behind everything (page, cards, borders, shaded bands, muted
// text), chosen independently of the color theme. Each has a light and a dark
// set; "classic" is the original look and the default. The CSS that applies
// them lives in globals.css (html[data-bg]).

export const BACKGROUND_NAMES = [
  "classic",
  "stone",
  "mist",
  "linen",
  "sage",
  "lavender",
  "blush",
  "twotone",
] as const;

export type BackgroundName = (typeof BACKGROUND_NAMES)[number];

export const BACKGROUND_LABEL: Record<BackgroundName, string> = {
  classic: "Classic",
  stone: "Stone",
  mist: "Mist",
  linen: "Linen",
  sage: "Sage",
  lavender: "Lavender",
  blush: "Blush",
  twotone: "Two-tone",
};

/** Picker tiles: [page, card, border] in light and dark. */
export const BACKGROUND_TILE: Record<BackgroundName, { light: [string, string, string]; dark: [string, string, string] }> = {
  classic: { light: ["#edf1f5", "#ffffff", "#dce3ea"], dark: ["#0b1220", "#161e2e", "#2a3547"] },
  stone: { light: ["#e7e5e1", "#ffffff", "#d6d2cc"], dark: ["#141312", "#1f1d1b", "#33302c"] },
  mist: { light: ["#e2eaf3", "#ffffff", "#cfdbe8"], dark: ["#0d1626", "#17233a", "#2a3a55"] },
  linen: { light: ["#f0eadf", "#fffdf8", "#e0d7c6"], dark: ["#15120e", "#221d17", "#362f26"] },
  sage: { light: ["#e6eadf", "#fbfcf8", "#d5dbcb"], dark: ["#10140f", "#1b211a", "#2d362b"] },
  lavender: { light: ["#e9e6f0", "#fdfcff", "#d9d3e4"], dark: ["#13101b", "#1f1a2b", "#332c45"] },
  blush: { light: ["#f2e6ea", "#fffafb", "#e4d3d9"], dark: ["#181014", "#261a20", "#3d2b33"] },
  twotone: { light: ["#ede6d8", "#f6f8ef", "#dcd6c4"], dark: ["#15120e", "#1b2119", "#2f3529"] },
};

/** Light, dark, or follow the device (v0.710; before, only on/off). */
export const APPEARANCE_MODES = ["system", "light", "dark"] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];
