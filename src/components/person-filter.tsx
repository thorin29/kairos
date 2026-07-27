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
 * Every badge is a fixed 64px-tall, 96px-wide slot, so circles are evenly
 * spaced and — crucially — the name pill's position is locked to the slot, not
 * to whatever is inside the circle. A photo, an icon, and an initial all sit
 * identically, so switching between them never nudges the pill.
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
      className={`hover-bounce group relative block h-16 w-24 shrink-0 outline-none transition-[filter,opacity] ${
        selected ? "" : "opacity-70 grayscale"
      }`}
    >
      {/* Block, fixed 64px, so there is no text-baseline gap and scaling stays
          centered on the circle. */}
      <span
        className={`block h-16 w-16 transition-transform ${
          selected ? "scale-105" : "group-hover:scale-105"
        }`}
      >
        {children}
      </span>
      {/* left-6 (24px) + px-2 (8px) puts the name's left edge at 32px — the
          center of the 64px circle. -bottom-2 hangs it low like a name tag. */}
      <span
        className={`absolute -bottom-2 left-6 z-10 max-w-[4.5rem] truncate rounded-full px-2 py-0.5 text-left font-semibold text-white shadow-sm ${fontFor(
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
