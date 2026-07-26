import Link from "next/link";
import { Avatar } from "@/components/avatar";

/**
 * A filter badge: a large profile circle with a small name pill tucked under
 * its bottom-right corner, tinted to the person's colour. Built to be reused
 * anywhere a person filter is wanted, not just the calendar.
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
      className="hover-bounce relative block rounded-2xl pb-4 pl-1 pr-6 pt-1 outline-none"
    >
      <span
        className={`inline-block rounded-full ${
          selected
            ? "ring-2 ring-accent ring-offset-2 ring-offset-[var(--color-ground)]"
            : ""
        }`}
      >
        <Avatar name={name} color={color} avatarPath={avatarPath} size="lg" />
      </span>

      <span
        className="absolute bottom-1 right-0 max-w-[7rem] truncate rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold shadow-sm"
        style={{
          backgroundColor: `${color}${selected ? "59" : "33"}`,
          borderColor: selected ? color : `${color}99`,
          color: "var(--color-ink)",
        }}
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
      className="hover-bounce relative block rounded-2xl pb-4 pl-1 pr-6 pt-1 outline-none"
    >
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full border border-dashed bg-ground font-display text-sm font-semibold text-muted ${
          selected ? "ring-2 ring-accent ring-offset-2 ring-offset-[var(--color-ground)] border-accent text-accent" : "border-hairline"
        }`}
      >
        All
      </span>

      <span
        className={`absolute bottom-1 right-0 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold shadow-sm ${
          selected
            ? "border-accent bg-accent text-white"
            : "border-hairline bg-surface text-muted"
        }`}
      >
        Everyone
      </span>
    </Link>
  );
}
