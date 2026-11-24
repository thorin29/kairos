import "server-only";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { replacedOccurrences } from "@/lib/calendar/overrides";
import { eventDays, tripDays, type TripEvent } from "@/lib/workouts/backpacking-days";

/** Backpacking trips from the calendar (v0.778): events of the Backpacking type. */

export async function tripEvents(): Promise<TripEvent[]> {
  const rows = (await prisma.event.findMany({
    where: { eventType: { is: { backpacking: true } }, cancelled: false },
    select: {
      id: true,
      title: true,
      userId: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      rrule: true,
      participants: { select: { userId: true } },
    },
  })) as {
    id: string;
    title: string;
    userId: string | null;
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
    rrule: string | null;
    participants: { userId: string }[];
  }[];
  const replaced = await replacedOccurrences(rows);
  return rows.map((r) => ({
    ...r,
    participants: r.participants.map((p) => p.userId),
    skip: [...(replaced.get(r.id) ?? [])],
  }));
}

/** A person's trip days in a range. */
export async function tripDaysFor(userId: string, fromISO: string, toISO: string): Promise<string[]> {
  return tripDays(await tripEvents(), userId, fromISO, toISO);
}

/** Today's trip, for the live map: who's on one. */
export async function onTripToday(userIds: string[]): Promise<Set<string>> {
  const today = todayISO();
  const events = await tripEvents();
  return new Set(userIds.filter((id) => tripDays(events, id, today, today).length > 0));
}


/** The person's trip event covering `iso` (v0.787): the trip tile's title,
 *  its Trip button (edit the event) and Finished. */
export async function tripEventOn(userId: string, iso: string): Promise<TripEvent | null> {
  const events = await tripEvents();
  return (
    events.find(
      (e) => (e.userId === userId || e.participants.includes(userId)) && eventDays(e, iso, iso).length > 0,
    ) ?? null
  );
}
