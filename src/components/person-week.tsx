import Link from "next/link";
import type { DayTask, GridEvent } from "@/lib/queries/calendar";
import { formatShort, formatWeekday } from "@/lib/dates";
import { Card } from "@/components/ui";

/**
 * A person's week in seven columns. Deliberately not the hour grid — on a
 * personal page the useful question is "what's coming up", not "when exactly
 * does Tuesday get busy", and a compact strip leaves room for the day's
 * tasks above it.
 */
export function PersonWeek({
  days,
  events,
  tasks,
  todayISO,
  prevHref,
  nextHref,
  thisWeekHref,
  fullHref,
  label,
}: {
  days: string[];
  events: GridEvent[];
  tasks: DayTask[];
  todayISO: string;
  prevHref: string;
  nextHref: string;
  thisWeekHref: string;
  fullHref: string;
  label: string;
}) {
  const nav =
    "inline-flex h-8 items-center rounded-full border border-hairline px-3 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          {label}
        </h2>
        <div className="flex items-center gap-1.5">
          <Link href={prevHref} className={nav} aria-label="Previous week">
            &larr;
          </Link>
          <Link href={thisWeekHref} className={nav}>
            This week
          </Link>
          <Link href={nextHref} className={nav} aria-label="Next week">
            &rarr;
          </Link>
          <Link href={fullHref} className={`${nav} ml-1`}>
            Full calendar
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 divide-x divide-hairline">
          {days.map((iso) => {
            const dayEvents = events
              .filter((e) => e.dayISO === iso)
              .sort(
                (a, b) =>
                  Number(b.allDay) - Number(a.allDay) || a.startMin - b.startMin,
              );
            const dayTasks = tasks.filter((t) => t.dayISO === iso);
            const doneCount = dayTasks.filter(
              (t) => t.status === "COMPLETE",
            ).length;
            const isToday = iso === todayISO;

            return (
              <div
                key={iso}
                className={`min-h-[7rem] p-2 ${isToday ? "bg-accent/5" : ""}`}
              >
                <div className="mb-2 text-center">
                  <span className="block text-[0.6rem] font-semibold uppercase tracking-widest text-muted">
                    {formatWeekday(iso)}
                  </span>
                  <span
                    className={`tabular mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      isToday ? "bg-accent text-white" : ""
                    }`}
                  >
                    {Number(iso.slice(8, 10))}
                  </span>
                </div>

                {dayTasks.length > 0 && (
                  <p className="tabular mb-1.5 text-center text-[0.65rem] text-muted">
                    {doneCount}/{dayTasks.length} tasks
                  </p>
                )}

                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    title={`${e.title}\n${e.timeLabel}`}
                    className="mb-0.5 block truncate rounded px-1 py-0.5 text-[0.62rem] font-medium text-white"
                    style={{ backgroundColor: e.color }}
                  >
                    {e.title}
                  </span>
                ))}

                {dayEvents.length > 3 && (
                  <span className="tabular block px-1 text-[0.62rem] text-muted">
                    +{dayEvents.length - 3}
                  </span>
                )}

                {dayEvents.length === 0 && dayTasks.length === 0 && (
                  <p className="text-center text-[0.65rem] text-muted/60">
                    &mdash;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <p className="tabular mt-2 text-xs text-muted">
        {formatShort(days[0])} &ndash; {formatShort(days[6])}
      </p>
    </section>
  );
}
