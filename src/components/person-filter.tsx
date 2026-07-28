import Link from "next/link";
import { Avatar } from "@/components/avatar";

// Longer names step the font down a touch so the pill never outgrows its slot.
function fontFor(label: string): string {
  if (label.length <= 8) return "text-xs";
  if (label.length <= 11) return "text-[0.7rem]";
  return "text-[0.6rem]";
}

/**
 * The shared "avatar": a fixed-size slot holding a 64px circle with a small
 * name pill tucked against its lower edge. Self-contained (the pill lives
 * inside the slot), so it drops in anywhere — calendar filters, dashboard
 * cards, workout cards — always the same size, and the pill never depends on
 * what's inside the circle.
 */
export function AvatarBadge({
  label,
  pillColor,
  selected = false,
  children,
}: {
  label: string;
  pillColor: string;
  selected?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="relative block h-[4.75rem] w-24 shrink-0">
      <span className="block h-16 w-16">{children}</span>
      {/* left-6 (24px) + px-2 (8px) → text starts at 32px, the circle's center. */}
      <span
        className={`absolute bottom-0 left-6 z-10 max-w-[4.5rem] truncate rounded-full px-2 py-0.5 text-left font-semibold text-white shadow-sm ${fontFor(
          label,
        )} ${selected ? "ring-2 ring-white/70" : ""}`}
        style={{ backgroundColor: pillColor }}
      >
        {label}
      </span>
    </span>
  );
}

/** A person's avatar (circle + name pill), for use on cards. */
export function PersonAvatar({
  name,
  color,
  avatarPath,
}: {
  name: string;
  color: string;
  avatarPath: string | null;
}) {
  return (
    <AvatarBadge label={name} pillColor={color}>
      <Avatar name={name} color={color} avatarPath={avatarPath} size="lg" />
    </AvatarBadge>
  );
}

// A plain little person silhouette — deliberately basic.
function PersonGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden
    >
      <circle cx="12" cy="8" r="4.2" />
      <path d="M4 20a8 8 0 0 1 16 0Z" />
    </svg>
  );
}

// How many people we can represent legibly inside the circle before it clutters.
const MAX_PEOPLE_GLYPHS = 6;

/** The Everyone circle: one little person per family member, shrinking as the
 *  family grows, laid out to fill the same 64px circle. */
function FamilyCircle({ count, color }: { count: number; color: string }) {
  const n = Math.max(1, Math.min(count, MAX_PEOPLE_GLYPHS));
  const size = n <= 1 ? 30 : n === 2 ? 22 : n === 3 ? 16 : 13;
  return (
    <span
      className="flex h-16 w-16 items-center justify-center rounded-full bg-ground"
      style={{ outline: `2.5px dashed ${color}`, outlineOffset: "0px" }}
    >
      <span className="flex max-w-[42px] flex-wrap items-center justify-center gap-[1.5px]">
        {Array.from({ length: n }).map((_, i) => (
          <PersonGlyph key={i} size={size} color={color} />
        ))}
      </span>
    </span>
  );
}

export function PersonFilterBadge({
  href,
  name,
  color,
  avatarPath,
  selected,
}: {
  href: string;
  name: string;
  color: string;
  avatarPath: string | null;
  selected: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={`hover-bounce block shrink-0 outline-none transition-[filter,opacity] ${
        selected ? "" : "opacity-70 grayscale"
      }`}
    >
      <AvatarBadge label={name} pillColor={color} selected={selected}>
        <Avatar name={name} color={color} avatarPath={avatarPath} size="lg" />
      </AvatarBadge>
    </Link>
  );
}

export function FamilyFilterBadge({
  href,
  selected,
  count,
  color,
}: {
  href: string;
  selected: boolean;
  count: number;
  color: string;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={`hover-bounce block shrink-0 outline-none transition-[filter,opacity] ${
        selected ? "" : "opacity-70 grayscale"
      }`}
    >
      <AvatarBadge label="Family" pillColor={color} selected={selected}>
        <FamilyCircle count={count} color={color} />
      </AvatarBadge>
    </Link>
  );
}
