/**
 * Family map card colours (v0.779): pure, shared by the server and Admin.
 * Home is green, each other zone its own colour (picked in Admin, else one
 * of these by name), and anyone not in a zone is coral.
 */
export const ZONE_PALETTE = ["#3B8A39", "#2E8C7A", "#3E63C9", "#C78A12", "#7A4DC0", "#C2417A", "#4F7D9E", "#8B5E34"] as const;
export const HOME_COLOR = "#3B8A39";
export const AWAY_COLOR = "#E0705F";

export function defaultZoneColor(name: string): string {
  if (name === "Home") return HOME_COLOR;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  // Green is Home's: other zones start at the second colour.
  return ZONE_PALETTE[1 + (h % (ZONE_PALETTE.length - 1))];
}

export function cleanColor(raw: unknown): string | null {
  return typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : null;
}

/** "mdi:hockey-sticks" → "mdiHockeySticks" (the @mdi/js export name). */
export function mdiName(icon: string): string | null {
  const m = /^mdi:([a-z0-9-]{1,64})$/.exec(icon.trim());
  if (!m) return null;
  return "mdi" + m[1].split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}
