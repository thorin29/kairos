import Link from "next/link";
import type { GridEvent } from "@/lib/queries/calendar";
import { DAY_SHORT } from "@/lib/days";
import { isSameMonth } from "@/lib/dates";

const MAX_CHIPS = 3;

/**
 * Month overview of scheduled events only. Chores and tasks are to-do
 * items with a due date, not things that occupy time, so they never appear
 * here — mixing them in produced "+1 more" counts that pointed at nothing
 * visible.
 *
 * Each cell shows a few chips and a count of the rest; the day view is one
 * click away.
 */
export function MonthGrid({
  days,
  monthISO,
  events,
  todayISO,
  hrefForDay,
}: {
  days: string[];
  monthISO: string;
  events: GridEvent[];
  todayISO: string;
  hrefForDay: (iso: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div className="grid grid-cols-7 border-b border-hairline">
        {DAY_SHORT.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-widest text-muted"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((iso, i) => {
          const dayEvents = events.filter((e) => e.dayISO === iso);
          const outside = !isSameMonth(iso, monthISO);
          const isToday = iso === todayISO;
          const chips = dayEvents.slice(0, MAX_CHIPS);
          const extra = dayEvents.length - chips.length;

          return (
            <Link
              key={iso}
              href={hrefForDay(iso)}
              className={`min-h-[6.5rem] border-b border-l border-hairline p-1.5 transition-colors hover:bg-ground ${
                i % 7 === 0 ? "border-l-0" : ""
              } ${outside ? "bg-ground/40" : ""}`}
            >
              <span
                className={`tabular mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday
                    ? "bg-accent text-white"
                    : outside
                      ? "text-muted/60"
                      : ""
                }`}
              >
                {Number(iso.slice(8, 10))}
              </span>

              {chips.map((e) => (
                <span
                  key={e.id}
                  className="mb-0.5 block truncate rounded px-1 py-0.5 text-[0.65rem] font-medium text-white"
                  style={{ backgroundColor: e.color }}
                >
                  {e.allDay ? e.title : `${e.timeLabel.split(" – ")[0]} ${e.title}`}
                </span>
              ))}

              {extra > 0 && (
                <span className="tabular block px-1 text-[0.65rem] text-muted">
                  +{extra} more
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
