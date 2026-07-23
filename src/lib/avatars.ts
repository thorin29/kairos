/**
 * A profile picture is either an uploaded file or one of the presets below.
 * Both live in User.avatarPath, distinguished by an "icon:" prefix — an
 * uploaded value is a bare filename, a preset is "icon:fox".
 *
 * No imports here on purpose: client components need the preset list.
 */

export const AVATAR_ICONS: Record<string, string> = {
  // Understated marks and symbols
  compass: "\u{1F9ED}",
  anchor: "\u{2693}",
  mountain: "\u{1F3D4}\uFE0F",
  wave: "\u{1F30A}",
  sunrise: "\u{1F305}",
  moon: "\u{1F319}",
  lightning: "\u{26A1}",
  flame: "\u{1F525}",
  evergreen: "\u{1F332}",
  maple: "\u{1F341}",
  chess: "\u{265F}\uFE0F",
  target: "\u{1F3AF}",
  key: "\u{1F511}",
  lantern: "\u{1F3EE}",
  telescope: "\u{1F52D}",
  hourglass: "\u{231B}",

  // Pursuits
  hockey: "\u{1F3D2}",
  soccer: "\u{26BD}",
  basketball: "\u{1F3C0}",
  weights: "\u{1F3CB}\uFE0F",
  running: "\u{1F3C3}",
  bike: "\u{1F6B2}",
  guitar: "\u{1F3B8}",
  piano: "\u{1F3B9}",
  camera: "\u{1F4F7}",
  palette: "\u{1F3A8}",
  book: "\u{1F4D6}",
  code: "\u{1F4BB}",
  wrench: "\u{1F527}",
  microscope: "\u{1F52C}",
  chef: "\u{1F373}",
  rocket: "\u{1F680}",

  // Creatures
  fox: "\u{1F98A}",
  bear: "\u{1F43B}",
  panda: "\u{1F43C}",
  cat: "\u{1F431}",
  dog: "\u{1F436}",
  owl: "\u{1F989}",
  turtle: "\u{1F422}",
  penguin: "\u{1F427}",
  wolf: "\u{1F43A}",
  eagle: "\u{1F985}",
  horse: "\u{1F40E}",
  dragon: "\u{1F409}",
};

export const ICON_PREFIX = "icon:";

export function isIcon(avatarPath: string | null | undefined): boolean {
  return Boolean(avatarPath?.startsWith(ICON_PREFIX));
}

export function iconGlyph(avatarPath: string | null | undefined): string | null {
  if (!isIcon(avatarPath)) return null;
  const key = avatarPath!.slice(ICON_PREFIX.length);
  return AVATAR_ICONS[key] ?? null;
}

/** URL that serves an uploaded avatar. */
export function avatarUrl(avatarPath: string): string {
  return `/api/avatars/${encodeURIComponent(avatarPath)}`;
}

/** Initial shown when someone hasn't picked anything. */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
