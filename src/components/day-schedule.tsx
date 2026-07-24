import Link from "next/link";
import type { GridEvent } from "@/lib/queries/calendar";
import { Card } from "@/components/ui";
import { CalendarIcon } from "@/components/icons";

/**
 * A day as a simple agenda rather than an hour grid. Used on the dashboard,
 * where a full grid for one day would be mostly empty space, and as the
 * calendar's day view.
 */
const navChip =
  "inline-flex h-8 items-center rounded-full border border-hairline px-3 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent";

export function DaySchedule({
  events,
  emptyText = "Nothing scheduled today.",
  href,
  title,
  compact = false,
  nav,
}: {
  events: GridEvent[];
  emptyText?: string;
  href?: string;
  title?: string;
  compact?: boolean;
  nav?: { prevHref: string; todayHref: string; nextHref: string };
}) {
  const sorted = [...events].sort(
    (a, b) => Number(b.allDay) - Number(a.allDay) || a.startMin - b.startMin,
  );

  const body =
    sorted.length === 0 ? (
      <p className="px-5 py-4 text-sm text-muted">{emptyText}</p>
    ) : (
      <ul className="divide-y divide-hairline">
        {sorted.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-5 py-3">
            <span
              aria-hidden
              className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: e.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{e.title}</p>
              <p className="tabular truncate text-xs text-muted">
                {e.timeLabel}
                {e.location ? ` · ${e.location}` : ""}
              </p>
            </div>
            {!compact && (
              <span className="shrink-0 text-xs text-muted">
                {e.ownerName}
              </span>
            )}
          </li>
        ))}
      </ul>
    );

  if (!title) return <Card className="overflow-hidden">{body}</Card>;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
          <CalendarIcon className="h-4 w-4" />
          {title}
        </h2>

        <div className="flex items-center gap-1.5">
          {nav && (
            <>
              <Link
                href={nav.prevHref}
                aria-label="Previous day"
                className={navChip}
              >
                &larr;
              </Link>
              <Link href={nav.todayHref} className={navChip}>
                Today
              </Link>
              <Link
                href={nav.nextHref}
                aria-label="Next day"
                className={navChip}
              >
                &rarr;
              </Link>
            </>
          )}
          {href && (
            <Link href={href} className={`${navChip} ml-1`}>
              Full calendar
            </Link>
          )}
        </div>
      </div>
      <Card className="overflow-hidden">{body}</Card>
    </section>
  );
}
