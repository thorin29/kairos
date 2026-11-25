import Link from "next/link";
import type { GridEvent } from "@/lib/queries/calendar";
import { AttendeeList } from "@/components/attendance";
import { Card } from "@/components/ui";
import { CalendarIcon } from "@/components/icons";

/**
 * A day as a simple agenda rather than an hour grid. Used on the dashboard,
 * where a full grid for one day would be mostly empty space, and as the
 * calendar's day view.
 */
const navChip =
  "inline-flex h-8 items-center rounded-full border border-hairline bg-surface px-3 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent";

export function DaySchedule({
  events,
  emptyText = "Nothing scheduled today.",
  href,
  title,
  compact = false,
  nav,
  fill = false,
}: {
  events: GridEvent[];
  emptyText?: string;
  href?: string;
  title?: string;
  compact?: boolean;
  nav?: { prevHref: string; todayHref: string; nextHref: string };
  /** Fill its column (v0.801, the shared home): the list scrolls on its own. */
  fill?: boolean;
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
                {e.location ? ` · ${e.locationName ?? e.location}` : ""}
              </p>
            </div>
            {!compact && (
              <span className="shrink-0">
                <AttendeeList event={e} align="start" />
              </span>
            )}
          </li>
        ))}
      </ul>
    );

  if (!title) return <Card className="overflow-hidden">{body}</Card>;

  return (
    <section className={fill ? "flex h-full min-h-0 flex-col" : undefined}>
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
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
      <Card className={fill ? "min-h-0 flex-1 overflow-y-auto" : "overflow-hidden"}>{body}</Card>
    </section>
  );
}

/**
 * Today's schedule as one card (v0.802, the shared home): its name and the
 * date in the card's own header with small ‹ › arrows for another day; the
 * header stays put and only the events scroll when the day is long. Not a way
 * into the calendar.
 */
export function ScheduleCard({
  events,
  title,
  dateLabel,
  prevHref,
  nextHref,
  todayHref,
}: {
  events: GridEvent[];
  title: string;
  dateLabel: string;
  prevHref: string;
  nextHref: string;
  /** Set when showing another day: the title goes back to today. */
  todayHref?: string;
}) {
  const sorted = [...events].sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startMin - b.startMin);
  const arrow =
    "flex h-7 w-7 items-center justify-center rounded-full text-base leading-none text-muted transition-colors hover:bg-ground hover:text-ink";
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-3">
        <CalendarIcon className="h-4 w-4 shrink-0 text-[#2563eb]" />
        <div className="min-w-0 flex-1">
          {todayHref ? (
            <Link href={todayHref} className="block truncate font-display text-[15px] font-semibold hover:text-accent" title="Back to today">
              {title}
            </Link>
          ) : (
            <p className="truncate font-display text-[15px] font-semibold">{title}</p>
          )}
          <p className="truncate text-xs text-muted">{dateLabel}</p>
        </div>
        <Link href={prevHref} aria-label="Previous day" className={arrow}>
          &lsaquo;
        </Link>
        <Link href={nextHref} aria-label="Next day" className={arrow}>
          &rsaquo;
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Nothing scheduled.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {sorted.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                <span aria-hidden className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="tabular truncate text-xs text-muted">
                    {e.timeLabel}
                    {e.location ? ` \u00b7 ${e.locationName ?? e.location}` : ""}
                  </p>
                </div>
                <span className="shrink-0">
                  <AttendeeList event={e} align="start" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
