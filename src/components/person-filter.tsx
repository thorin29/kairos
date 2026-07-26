import Link from "next/link";
import { Avatar } from "@/components/avatar";

// The "for all" symbol, standing in for a profile photo on the Everyone badge.
const FOR_ALL = "\u2200";

// Longer names step the font down a touch so the pill never outgrows its slot.
function fontFor(label: string): string {
  if (label.length <= 8) return "text-xs";
  if (label.length <= 11) return "text-[0.7rem]";
  return "text-[0.6rem]";
}

/**
 * Every badge is the same fixed width, so the circles are evenly spaced no
 * matter the name lengths. Within that slot the circle sits at the left and
 * the name pill's text begins at the circle's center, extending right — the
 * "shifted right" look, kept uniform so pills never touch their neighbour.
 */
function Badge({
  href,
  selected,
  label,
  pillColor,
  children,
}: {
  href: string;
  selected: boolean;
  label: string;
  pillColor: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={`hover-bounce group relative w-[6.75rem] shrink-0 outline-none transition-[filter,opacity] ${
        selected ? "" : "opacity-70 grayscale"
      }`}
    >
      <span
        className={`inline-block transition-transform ${
          selected ? "scale-105" : "group-hover:scale-105"
        }`}
      >
        {children}
      </span>
      {/* left-6 (24px) + px-2 (8px) puts the text's left edge at 32px — the
          center of the 64px circle. */}
      <span
        className={`absolute -bottom-1 left-6 z-10 max-w-[4.75rem] truncate rounded-full px-2 py-0.5 text-left font-semibold text-white shadow-sm ${fontFor(
          label,
        )} ${selected ? "ring-2 ring-white/70" : ""}`}
        style={{ backgroundColor: pillColor }}
      >
        {label}
      </span>
    </Link>
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
    <Badge href={href} selected={selected} label={name} pillColor={color}>
      <Avatar name={name} color={color} avatarPath={avatarPath} size="lg" />
    </Badge>
  );
}

export function AllFilterBadge({
  href,
  selected,
}: {
  href: string;
  selected: boolean;
}) {
  return (
    <Badge
      href={href}
      selected={selected}
      label="Everyone"
      pillColor="var(--color-accent)"
    >
      {/* Same 64px footprint as an Avatar: dashed outline drawn outside the
          circle, matching the avatar's 2.5px boxShadow ring. */}
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full bg-ground font-display text-3xl leading-none text-muted"
        style={{ outline: "2.5px dashed var(--color-accent)", outlineOffset: "0px" }}
      >
        {FOR_ALL}
      </span>
    </Badge>
  );
}
