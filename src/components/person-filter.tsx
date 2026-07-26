import Link from "next/link";
import { Avatar } from "@/components/avatar";

// The "for all" symbol, standing in for a profile photo on the Everyone badge.
const FOR_ALL = "\u2200";

/**
 * One shared badge layout so every filter is identical: a 64px circle with a
 * small name pill tucked against its lower edge, nudged slightly right. The
 * only differences between a person and Everyone are what's in the circle and
 * the pill's colour — never the size or position, so bottoms always line up.
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
      className="hover-bounce group relative inline-block outline-none"
    >
      <span
        className={`block transition-transform ${
          selected ? "scale-105" : "group-hover:scale-105"
        }`}
      >
        {children}
      </span>
      <span
        className={`absolute -bottom-1 left-[calc(50%-0.75rem)] z-10 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-semibold text-white shadow-sm ${
          selected ? "ring-2 ring-white/70" : ""
        }`}
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
