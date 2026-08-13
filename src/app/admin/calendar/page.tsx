import { prisma } from "@/lib/prisma";
import { AdminBack } from "@/components/admin-back";
import { Card, SectionHeading } from "@/components/ui";
import { loadEventTypes } from "@/lib/queries/calendar";
import { getCalendarPrefs, getFamilyColor } from "@/lib/settings";
import { Subscriptions } from "./subscriptions";
import { EventTypes } from "./event-types";
import { DisplayPrefs } from "./display-prefs";
import { PauseForm } from "./pause-form";
import { Holidays } from "./holidays";
import { loadHolidayList, getHolidayColor } from "@/lib/holidays";
import { loadPauses } from "@/lib/actions/pauses";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  const [calendars, people, eventTypes] = await Promise.all([
    prisma.externalCalendar.findMany({
      orderBy: { name: "asc" },
      include: {
        user: { select: { name: true, displayName: true, color: true } },
        _count: { select: { events: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true, color: true },
    }),
    loadEventTypes(),
  ]);
  const calPrefs = await getCalendarPrefs();
  const pauses = await loadPauses();
  const familyColor = await getFamilyColor();
  const holidays = await loadHolidayList();
  const holidayColor = await getHolidayColor();

  const subscriptions = calendars.map((c) => ({
    id: c.id,
    name: c.name,
    url: c.url,
    ownerName: c.isFamily
      ? "Family"
      : (c.user?.displayName ?? c.user?.name ?? "Family"),
    ownerColor: c.isFamily ? familyColor : (c.user?.color ?? familyColor),
    eventCount: c._count.events,
    sportWorkout: c.sportWorkout,
    lastFetchedAt: c.lastFetchedAt?.toISOString() ?? null,
    lastError: c.lastError,
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Calendar feeds
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Public calendars the household subscribes to. Anyone can add their
          own events from the calendar page; adding and removing feeds is a
          parent job because it changes what everyone sees.
        </p>
      </header>

      <SectionHeading>Subscriptions</SectionHeading>
      <Subscriptions
        subscriptions={subscriptions}
        people={people.map((p) => ({
          id: p.id,
          name: p.displayName ?? p.name,
          color: p.color,
        }))}
      />

      <div className="mt-10">
        <SectionHeading>Event types</SectionHeading>
        <p className="mb-3 max-w-xl text-sm text-muted">
          Custom types anyone can pick when adding an event — a hockey game, a
          medical appointment — each with its own colour on the calendar.
        </p>
        <EventTypes types={eventTypes} />
      </div>

      <div className="mt-10">
        <SectionHeading>Calendar display</SectionHeading>
        <p className="mb-3 max-w-xl text-sm text-muted">
          The now-line marks the current time on the day and week grids.
        </p>
        <DisplayPrefs
          nowColor={calPrefs.nowColor}
          resetSec={calPrefs.scrollResetSec}
          blockMinutes={calPrefs.blockMinutes}
        />
      </div>

      <div className="mt-10">
        <SectionHeading>Holidays</SectionHeading>
        <Holidays rows={holidays} color={holidayColor} />
      </div>

      <div className="mt-10">
        <SectionHeading>Vacations &amp; pauses</SectionHeading>
        <Card className="p-5">
          <PauseForm pauses={pauses} />
        </Card>
      </div>
    </main>
  );
}
