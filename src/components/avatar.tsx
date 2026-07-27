import { avatarUrl, iconGlyph, initialOf, isIcon } from "@/lib/avatars";

const sizes = {
  sm: "h-9 w-9 text-base",
  md: "h-12 w-12 text-xl",
  lg: "h-16 w-16 text-3xl",
} as const;

/**
 * Falls back through uploaded photo, chosen icon, then the first letter of the
 * name — so there is never an empty hole in a layout.
 *
 * The outer circle is ALWAYS the same element and size; only its contents
 * change. That way adding or removing a photo never shifts the box or anything
 * positioned against it (e.g. the calendar name tags). The person's colour is
 * the ring, so a photo stays legible while still being identifiable.
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
  const isPhoto = !!avatarPath && !isIcon(avatarPath);
  const glyph = iconGlyph(avatarPath);

  return (
    <span
      aria-hidden
      className={`${sizes[size]} block shrink-0 overflow-hidden rounded-full align-middle select-none`}
      style={{
        boxShadow: `0 0 0 2.5px ${color}`,
        backgroundColor: isPhoto ? undefined : `${color}1a`,
        color,
      }}
    >
      {isPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl(avatarPath)}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          {glyph ?? (
            <span className="font-display font-semibold">{initialOf(name)}</span>
          )}
        </span>
      )}
    </span>
  );
}
