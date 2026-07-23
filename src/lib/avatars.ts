/**
 * A profile picture is either an uploaded file or one of the presets below.
 * Both live in User.avatarPath, distinguished by an "icon:" prefix — an
 * uploaded value is a bare filename, a preset is "icon:fox".
 *
 * No imports here on purpose: client components need the preset list.
 */

export const AVATAR_ICONS: Record<string, string> = {
  fox: "\u{1F98A}",
  bear: "\u{1F43B}",
  panda: "\u{1F43C}",
  cat: "\u{1F431}",
  dog: "\u{1F436}",
  owl: "\u{1F989}",
  turtle: "\u{1F422}",
  penguin: "\u{1F427}",
  soccer: "\u{26BD}",
  hockey: "\u{1F3D2}",
  guitar: "\u{1F3B8}",
  rocket: "\u{1F680}",
  star: "\u{2B50}",
  book: "\u{1F4D6}",
  paint: "\u{1F3A8}",
  leaf: "\u{1F343}",
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
