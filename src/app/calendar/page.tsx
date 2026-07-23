import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadWeek, loadWeekTasks } from "@/lib/queries/calendar";
import { syncStaleCalendars } from "@/lib/calendar/sync";
import { addDays, formatShort, startOfWeek, todayISO } from "@/lib/dates";
import { CalendarView } from "@/components/calendar-view";
import { Subscriptions } from "./subscriptions";
import { BackLink, DoneBar } from "@/components/back-link";
import { SectionHeading } from "@/components/ui";
import { Avatar } from "@/components/avatar";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; who?: string }>;
}) {
  const { week, who } = await searchParams;

  const today = todayISO();
  const anchor = startOfWeek(
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today,
  );
  const userId = who || undefined;

  // Keeps feeds current without a scheduler. Failures are recorded against
  // the subscription, so a dead feed can't blank the page.
  await syncStaleCalendars();

  const [{ days, timed, allDay }, tasks, people, calendars] =
    await Promise.all([
      loadWeek(anchor, userId),
      loadWeekTasks(anchor, userId),
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

  const link = (params: { week?: string; who?: string }) => {
    const q = new URLSearchParams();
    if (params.week) q.set("week", params.week);
    if (params.who) q.set("who", params.who);
    const s = q.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };

  const chip =
    "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <BackLink />

      <header className="mb-6 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Calendar
          </h1>
          <p className="tabular mt-1 text-sm text-muted">
            {formatShort(days[0])} &ndash; {formatShort(days[6])}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={link({ week: addDays(anchor, -7), who: userId })}
            className={`${chip} border-hairline hover:border-accent hover:text-accent`}
          >
            &larr; Prev
          </Link>
          <Link
            href={link({ who: userId })}
            className={`${chip} border-hairline hover:border-accent hover:text-accent`}
          >
            Today
          </Link>
          <Link
            href={link({ week: addDays(anchor, 7), who: userId })}
            className={`${chip} border-hairline hover:border-accent hover:text-accent`}
          >
            Next &rarr;
          </Link>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={link({ week: anchor })}
          className={`${chip} ${
            userId
              ? "border-hairline text-muted hover:border-accent"
              : "border-accent bg-accent/10 text-accent"
          }`}
        >
          Everyone
        </Link>
        {people.map((p) => (
          <Link
            key={p.id}
            href={link({ week: anchor, who: p.id })}
            className={`${chip} ${
              userId === p.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-hairline hover:border-accent"
            }`}
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

      <CalendarView
        days={days}
        timed={timed}
        allDay={allDay}
        tasks={tasks}
        todayISO={today}
      />

      <section className="mt-12">
        <SectionHeading>Subscribed calendars</SectionHeading>
        <Subscriptions subscriptions={subscriptions} people={people.map((p) => ({ id: p.id, name: p.displayName ?? p.name, color: p.color }))} />
      </section>

      <DoneBar />
    </main>
  );
}
