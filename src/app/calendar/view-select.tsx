"use client";

import { useRouter } from "next/navigation";

/** Day/Week/Month as a compact dropdown that navigates on change. */
export function CalendarViewSelect({
  view,
  options,
}: {
  view: string;
  options: { key: string; label: string; href: string }[];
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Calendar view"
      value={view}
      onChange={(e) => {
        const next = options.find((o) => o.key === e.target.value);
        if (next) router.push(next.href);
      }}
      className="h-10 rounded-full border border-hairline bg-surface px-4 text-sm font-medium text-ink outline-none transition-colors hover:border-accent focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
