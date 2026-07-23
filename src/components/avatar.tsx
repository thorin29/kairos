import { avatarUrl, iconGlyph, initialOf, isIcon } from "@/lib/avatars";

const sizes = {
  sm: "h-9 w-9 text-base",
  md: "h-12 w-12 text-xl",
  lg: "h-16 w-16 text-3xl",
} as const;

/**
 * Falls back through uploaded photo, chosen icon, then the first letter of
 * the name — so there is never an empty hole in a layout.
 *
 * The person's colour is the ring rather than the fill, so a photo stays
 * legible while still being identifiable at a glance.
 */
export function Avatar({
  name,
  color,
  avatarPath,
  size = "md",
}: {
  name: string;
  color: string;
  avatarPath?: string | null;
  size?: keyof typeof sizes;
}) {
  const glyph = iconGlyph(avatarPath);

  const shell = `${sizes[size]} shrink-0 overflow-hidden rounded-full flex items-center justify-center select-none`;
  const ring = { boxShadow: `0 0 0 2.5px ${color}` };

  if (avatarPath && !isIcon(avatarPath)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl(avatarPath)}
        alt=""
        className={`${shell} object-cover`}
        style={ring}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={shell}
      style={{ ...ring, backgroundColor: `${color}1a`, color }}
    >
      {glyph ?? (
        <span className="font-display font-semibold">{initialOf(name)}</span>
      )}
    </span>
  );
}
