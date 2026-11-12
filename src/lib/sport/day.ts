import "server-only";
import { prisma } from "@/lib/prisma";
import { householdTz, localParts } from "@/lib/dates";
import { occurrencesIn } from "@/lib/calendar/recur";
import { sportDayLabel, sportKindOf, type SportKind } from "@/lib/sport/label";

/**
 * A person's sport on a day (v0.662): the first sport-flagged calendar event
 * they're in that day (an event of a sport type, or from a sport feed),
 * whether or not it has happened yet. Who's in it follows the "Did you
 * play?" prompts (generate.ts pendingSportPrompts): the owner, every
 * participant, and a sport feed's owner and members.
 */
export async function sportOn(userId: string, dateISO: string): Promise<{ eventId: string; title: string } | null> {
  const tz = householdTz();
  const events = (await prisma.event.findMany({
    where: {
      OR: [{ eventType: { is: { sportWorkout: true } } }, { externalCalendar: { is: { sportWorkout: true } } }],
    },
    select: {
      id: true,
      userId: true,
      title: true,
      startsAt: true,
      rrule: true,
      participants: { select: { userId: true } },
      eventType: { select: { sportWorkout: true, name: true } },
      externalCalendar: { select: { sportWorkout: true, userId: true, memberIds: true, name: true } },
    },
    orderBy: { startsAt: "asc" },
  })) as {
    id: string;
    userId: string | null;
    title: string | null;
    startsAt: Date;
    rrule: string | null;
    participants: { userId: string }[];
    eventType: { sportWorkout: boolean; name: string } | null;
    externalCalendar: { sportWorkout: boolean; userId: string | null; memberIds: string[] | null; name: string } | null;
  }[];
  for (const e of events) {
    const mine =
      e.userId === userId ||
      e.participants.some((p) => p.userId === userId) ||
      (!!e.externalCalendar?.sportWorkout &&
        (e.externalCalendar.userId === userId || (e.externalCalendar.memberIds ?? []).includes(userId)));
    if (!mine) continue;
    const on = e.rrule
      ? occurrencesIn(e.startsAt, e.rrule, dateISO, dateISO, tz).length > 0
      : localParts(e.startsAt).iso === dateISO;
    if (on) return { eventId: e.id, title: sportDayLabel(e.title, e.eventType?.name, e.externalCalendar?.name) };
  }
  return null;
}

/**
 * A person's sport events from one day to another (v0.676), one per event per
 * day, with whether each is a game or a practice (sportKindOf).
 */
export async function sportDaysBetween(
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<{ date: string; label: string; kind: SportKind }[]> {
  const tz = householdTz();
  const events = (await prisma.event.findMany({
    where: {
      OR: [{ eventType: { is: { sportWorkout: true } } }, { externalCalendar: { is: { sportWorkout: true } } }],
    },
    select: {
      id: true,
      userId: true,
      title: true,
      startsAt: true,
      rrule: true,
      participants: { select: { userId: true } },
      eventType: { select: { name: true, sportKind: true } },
      externalCalendar: { select: { sportWorkout: true, userId: true, memberIds: true, name: true } },
    },
  })) as {
    id: string;
    userId: string | null;
    title: string | null;
    startsAt: Date;
    rrule: string | null;
    participants: { userId: string }[];
    eventType: { name: string; sportKind: string | null } | null;
    externalCalendar: { sportWorkout: boolean; userId: string | null; memberIds: string[] | null; name: string } | null;
  }[];
  const out: { date: string; label: string; kind: SportKind }[] = [];
  for (const e of events) {
    const mine =
      e.userId === userId ||
      e.participants.some((p) => p.userId === userId) ||
      (!!e.externalCalendar?.sportWorkout &&
        (e.externalCalendar.userId === userId || (e.externalCalendar.memberIds ?? []).includes(userId)));
    if (!mine) continue;
    const days = e.rrule
      ? occurrencesIn(e.startsAt, e.rrule, fromISO, toISO, tz).map((d) => localParts(d, tz).iso)
      : [localParts(e.startsAt).iso].filter((d) => d >= fromISO && d <= toISO);
    const label = sportDayLabel(e.title, e.eventType?.name, e.externalCalendar?.name);
    const kind = sportKindOf(e.title, e.eventType?.sportKind);
    for (const date of new Set(days)) out.push({ date, label, kind });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
