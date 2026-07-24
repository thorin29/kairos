import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  loadRange,
  loadTasksForDays,
  type DayTask,
  type GridEvent,
} from "@/lib/queries/calendar";
import { syncStaleCalendars } from "@/lib/calendar/sync";
import {
  addDays,
  addMonths,
  formatLong,
  formatMonth,
  formatShort,
  monthGridDays,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekDays,
} from "@/lib/dates";
import { CalendarView } from "@/components/calendar-view";
import { DaySchedule } from "@/components/day-schedule";
import { MonthGrid } from "@/components/month-grid";
import { Subscriptions } from "./subscriptions";
import { AddEventForm } from "./add-event-form";
import { BackLink } from "@/components/back-link";
import { SectionHeading } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { isAdmin } from "@/lib/session";
import { DeleteEventButton } from "@/components/event-actions";
import { canDeleteEvent } from "@/lib/can-delete-event";

export const dynamic = "force-dynamic";

type View = "day" | "week" | "month";

const VIEWS: { key: View; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; who?: string }>;
}) {
  const { view: rawView, date: rawDate, who } = await searchParams;

  const today = todayISO();
  const view: View =
    rawView === "day" || rawView === "month" ? rawView : "week";
  const date =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const userId = who || undefined;

  // The span each view covers, and how far the arrows move.
  const days =
    view === "day"
      ? [date]
      : view === "week"
        ? weekDays(date)
        : monthGridDays(date);

  const step = (n: number) =>
    view === "day"
      ? addDays(date, n)
      : view === "week"
        ? addDays(startOfWeek(date), n * 7)
        : addMonths(startOfMonth(date), n);

  await syncStaleCalendars();
  const admin = await isAdmin();

  const [range, tasks, people, calendars] = await Promise.all([
    loadRange(days, userId),
    loadTasksForDays(days, userId),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true,
      },
    }),
    prisma.externalCalendar.findMany({
      orderBy: { name: "asc" },
      include: {
        user: { select: { name: true, displayName: true, color: true } },
        _count: { select: { events: true } },
      },
    }),
  ]);

  const subscriptions = calendars.map((c) => ({
    id: c.id,
    name: c.name,
    url: c.url,
    ownerName: c.user.displayName ?? c.user.name,
    ownerColor: c.user.color,
    eventCount: c._count.events,
    lastFetchedAt: c.lastFetchedAt?.toISOString() ?? null,
    lastError: c.lastError,
  }));

  const link = (p: { view?: View; date?: string; who?: string }) => {
    const q = new URLSearchParams();
    if (p.view && p.view !== "week") q.set("view", p.view);
    if (p.date) q.set("date", p.date);
    if (p.who) q.set("who", p.who);
    const s = q.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };

  const heading =
    view === "day"
      ? formatLong(date)
      : view === "month"
        ? formatMonth(date)
        : `${formatShort(days[0])} – ${formatShort(days[6])}`;

  const chip =
    "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors";
  const idle = "border-hairline hover:border-accent hover:text-accent";
  const active = "border-accent bg-accent/10 text-accent";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <BackLink />

      <header className="mb-5 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Calendar
          </h1>
          <p className="tabular mt-1 text-sm text-muted">{heading}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 inline-flex rounded-full border border-hairline p-0.5">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={link({ view: v.key, date, who: userId })}
                className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                  view === v.key
                    ? "bg-accent text-white"
                    : "text-muted hover:text-accent"
                }`}
              >
                {v.label}
              </Link>
            ))}
          </div>

          <Link
            href={link({ view, date: step(-1), who: userId })}
            className={`${chip} ${idle}`}
          >
            &larr;
          </Link>
          <Link href={link({ view, who: userId })} className={`${chip} ${idle}`}>
            Today
          </Link>
          <Link
            href={link({ view, date: step(1), who: userId })}
            className={`${chip} ${idle}`}
          >
            &rarr;
          </Link>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={link({ view, date })}
          className={`${chip} ${userId ? idle : active}`}
        >
          Everyone
        </Link>
        {people.map((p) => (
          <Link
            key={p.id}
            href={link({ view, date, who: p.id })}
            className={`${chip} ${userId === p.id ? active : idle}`}
          >
            <Avatar
              name={p.displayName ?? p.name}
              color={p.color}
              avatarPath={p.avatarPath}
              size="sm"
            />
            {p.displayName ?? p.name}
          </Link>
        ))}
      </div>

      <p className="mb-4 text-xs text-muted">
        {userId
          ? "Filtered to one person, so colours show the kind of commitment."
          : "Showing everyone, so colours show whose commitment it is."}
      </p>

      {view === "week" && (
        <CalendarView
          days={days}
          timed={range.timed}
          allDay={range.allDay}
          tasks={tasks}
          todayISO={today}
          admin={admin}
        />
      )}

      {view === "day" && (
        <DayPanel date={date} range={range} tasks={tasks} admin={admin} />
      )}

      {view === "month" && (
        <MonthGrid
          days={days}
          monthISO={startOfMonth(date)}
          events={[...range.allDay, ...range.timed]}
          todayISO={today}
          hrefForDay={(iso) => link({ view: "day", date: iso, who: userId })}
        />
      )}

      <section className="mt-10">
        <SectionHeading>Add your own event</SectionHeading>
        <AddEventForm
          people={people.map((p) => ({
            id: p.id,
            name: p.displayName ?? p.name,
          }))}
          defaultDate={view === "month" ? today : date}
        />
      </section>

      <section className="mt-12">
        <SectionHeading>Subscribed calendars</SectionHeading>
        <Subscriptions
          subscriptions={subscriptions}
          people={people.map((p) => ({
            id: p.id,
            name: p.displayName ?? p.name,
            color: p.color,
          }))}
        />
      </section>
    </main>
  );
}

function DayPanel({
  date,
  range,
  tasks,
  admin,
}: {
  date: string;
  range: { timed: GridEvent[]; allDay: GridEvent[] };
  tasks: DayTask[];
  admin: boolean;
}) {
  const dayTasks = tasks.filter((t) => t.dayISO === date);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <SectionHeading>To do</SectionHeading>
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
          {dayTasks.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Nothing due.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {dayTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                  <span
                    aria-hidden
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-sm ${
                        t.status === "COMPLETE" ? "text-muted line-through" : ""
                      }`}
                    >
                      {t.title}
                    </p>
                    <p className="text-xs text-muted">{t.ownerName}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <SectionHeading>Schedule</SectionHeading>
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
          {range.allDay.length + range.timed.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {[...range.allDay, ...range.timed]
                .filter((e) => e.dayISO === date)
                .sort(
                  (a, b) =>
                    Number(b.allDay) - Number(a.allDay) ||
                    a.startMin - b.startMin,
                )
                .map((e) => (
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
                      <p className="truncate text-xs text-muted">
                        {e.ownerName}
                        {e.recurring ? " · repeats" : ""}
                        {e.calendarName ? ` · ${e.calendarName}` : ""}
                      </p>
                    </div>
                    {canDeleteEvent(e, admin) && (
                      <DeleteEventButton event={e} />
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
