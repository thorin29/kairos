import Link from "next/link";
import { Avatar } from "@/components/avatar";

// Longer names step the font down a touch so the pill never outgrows its slot.
function fontFor(label: string, compact = false): string {
  if (compact) {
    if (label.length <= 8) return "text-[0.65rem]";
    return "text-[0.55rem]";
  }
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
  compact = false,
  children,
}: {
  label: string;
  pillColor: string;
  selected?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`relative block shrink-0 ${
        compact ? "h-[3.9rem] w-20" : "h-[4.75rem] w-24"
      }`}
    >
      <span className={compact ? "block h-12 w-12" : "block h-16 w-16"}>
        {children}
      </span>
      {/* Pill tucked to the circle's lower edge, its left roughly at the centre. */}
      <span
        className={`absolute bottom-0 z-10 truncate rounded-full text-left font-semibold text-white shadow-sm ${
          compact
            ? "left-5 max-w-[3.4rem] px-1.5 py-0.5"
            : "left-6 max-w-[4.5rem] px-2 py-0.5"
        } ${fontFor(label, compact)} ${selected ? "ring-2 ring-white/70" : ""}`}
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
  avatarPosition,
}: {
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition?: string | null;
}) {
  return (
    <AvatarBadge label={name} pillColor={color}>
      <Avatar
        name={name}
        color={color}
        avatarPath={avatarPath}
        avatarPosition={avatarPosition}
        size="lg"
      />
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
function FamilyCircle({
  count,
  color,
  compact = false,
}: {
  count: number;
  color: string;
  compact?: boolean;
}) {
  const n = Math.max(1, Math.min(count, MAX_PEOPLE_GLYPHS));
  const base = n <= 1 ? 30 : n === 2 ? 22 : n === 3 ? 16 : 13;
  const size = compact ? Math.round(base * 0.75) : base;
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-ground ${
        compact ? "h-12 w-12" : "h-16 w-16"
      }`}
      style={{ outline: `2.5px dashed ${color}`, outlineOffset: "0px" }}
    >
      <span
        className={`flex flex-wrap items-center justify-center gap-[1.5px] ${
          compact ? "max-w-[32px]" : "max-w-[42px]"
        }`}
      >
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
  avatarPosition,
  selected,
  compact = false,
}: {
  href: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition?: string | null;
  selected: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={`hover-bounce block shrink-0 outline-none transition-[filter,opacity] ${
        selected ? "" : "opacity-70 grayscale"
      }`}
    >
      <AvatarBadge
        label={name}
        pillColor={color}
        selected={selected}
        compact={compact}
      >
        <Avatar
          name={name}
          color={color}
          avatarPath={avatarPath}
          avatarPosition={avatarPosition}
          size={compact ? "md" : "lg"}
        />
      </AvatarBadge>
    </Link>
  );
}

export function FamilyFilterBadge({
  href,
  selected,
  count,
  color,
  compact = false,
}: {
  href: string;
  selected: boolean;
  count: number;
  color: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={`hover-bounce block shrink-0 outline-none transition-[filter,opacity] ${
        selected ? "" : "opacity-70 grayscale"
      }`}
    >
      <AvatarBadge
        label="Family"
        pillColor={color}
        selected={selected}
        compact={compact}
      >
        <FamilyCircle count={count} color={color} compact={compact} />
      </AvatarBadge>
    </Link>
  );
}
