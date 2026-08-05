import Link from "next/link";
import {
  monthGridDays,
  isSameMonth,
  formatMonth,
  startOfMonth,
} from "@/lib/dates";

const INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * A small month calendar for the sidebar: month name with prev/next arrows,
 * today marked, the days currently in view highlighted. Each day links into the
 * current view for that date.
 */
export function MiniMonth({
  monthISO,
  todayISO,
  selectedDays,
  dayHref,
  prevHref,
  nextHref,
}: {
  monthISO: string;
  todayISO: string;
  selectedDays: string[];
  dayHref: (iso: string) => string;
  prevHref: string;
  nextHref: string;
}) {
  const month = startOfMonth(monthISO);
  const cells = monthGridDays(month);
  const selected = new Set(selectedDays);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{formatMonth(month)}</span>
        <div className="flex items-center gap-0.5">
          <Link
            href={prevHref}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
          >
            &lsaquo;
          </Link>
          <Link
            href={nextHref}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
          >
            &rsaquo;
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {INITIALS.map((d, i) => (
          <span
            key={i}
            className="pb-1 text-center text-[0.6rem] font-semibold uppercase text-muted"
          >
            {d}
          </span>
        ))}
        {cells.map((iso) => {
          const inMonth = isSameMonth(iso, month);
          const isToday = iso === todayISO;
          const isSel = selected.has(iso);
          return (
            <Link
              key={iso}
              href={dayHref(iso)}
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors ${
                isToday
                  ? "bg-accent font-semibold text-white"
                  : isSel
                    ? "bg-accent/15 text-ink"
                    : "hover:bg-ground"
              } ${inMonth ? "" : "text-muted/50"}`}
            >
              {Number(iso.slice(8, 10))}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
