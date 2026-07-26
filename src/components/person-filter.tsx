import Link from "next/link";
import { Avatar } from "@/components/avatar";

// The "for all" symbol, standing in for a profile photo on the Everyone badge.
const FOR_ALL = "\u2200";

// Every badge is the same fixed width so the row is evenly spaced no matter how
// long the names are; the font steps down a little for longer names so they
// still fit the same pill.
function fontFor(label: string): string {
  if (label.length <= 8) return "text-xs";
  if (label.length <= 11) return "text-[0.7rem]";
  return "text-[0.6rem]";
}

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
      className={`hover-bounce group relative flex w-20 flex-col items-center outline-none transition-[filter,opacity] ${
        selected ? "" : "opacity-70 grayscale"
      }`}
    >
      <span
        className={`block transition-transform ${
          selected ? "scale-105" : "group-hover:scale-105"
        }`}
      >
        {children}
      </span>
      <span
        className={`absolute -bottom-1 left-1/2 z-10 w-[4.75rem] -translate-x-1/2 truncate rounded-full px-2 py-0.5 text-center font-semibold text-white shadow-sm ${fontFor(
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
