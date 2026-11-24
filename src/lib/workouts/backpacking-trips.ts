import "server-only";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { replacedOccurrences } from "@/lib/calendar/overrides";
import { tripDays, type TripEvent } from "@/lib/workouts/backpacking-days";

/** Backpacking trips from the calendar (v0.778): events of the Backpacking type. */

export async function tripEvents(): Promise<TripEvent[]> {
  const rows = (await prisma.event.findMany({
    where: { eventType: { is: { backpacking: true } }, cancelled: false },
    select: {
      id: true,
      userId: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      rrule: true,
      participants: { select: { userId: true } },
    },
  })) as {
    id: string;
    userId: string | null;
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
    rrule: string | null;
    participants: { userId: string }[];
  }[];
  const replaced = await replacedOccurrences(rows);
  return rows.map(({ id, ...r }) => ({
    ...r,
    participants: r.participants.map((p) => p.userId),
    skip: [...(replaced.get(id) ?? [])],
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

