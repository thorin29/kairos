import Link from "next/link";
import { Avatar } from "@/components/avatar";

// The "for all" symbol, standing in for a profile photo on the Everyone badge.
const FOR_ALL = "\u2200";

const RING_SELECTED =
  "ring-2 ring-accent ring-offset-2 ring-offset-[var(--color-ground)]";

/**
 * A filter badge: a large profile circle with a small, dark name pill tucked
 * in front of its bottom-right corner — white text, sized to the whole name.
 * Reusable anywhere a person filter is wanted, not just the calendar.
 */
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
      className="hover-bounce group relative inline-block outline-none"
    >
      <span
        className={`block rounded-full transition-transform ${
          selected ? `${RING_SELECTED} scale-105` : "group-hover:scale-105"
        }`}
      >
        <Avatar name={name} color={color} avatarPath={avatarPath} size="lg" />
      </span>

      <span
        className="absolute bottom-0 left-[58%] z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 px-3 py-0.5 text-xs font-semibold text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </Link>
  );
}

/** The "Everyone" option — no photo, but the same shape as the people. */
export function AllFilterBadge({
  href,
  selected,
}: {
  href: string;
  selected: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className="hover-bounce group relative inline-block outline-none"
    >
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full border border-dashed bg-ground transition-transform ${
          selected
            ? `${RING_SELECTED} scale-105 border-accent`
            : "border-hairline group-hover:scale-105"
        }`}
      >
        <span className="font-display text-3xl leading-none text-muted">
          {FOR_ALL}
        </span>
      </span>

      <span className="absolute bottom-0 left-[58%] z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 bg-accent px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
        Everyone
      </span>
    </Link>
  );
}
