import "server-only";
import { prisma } from "@/lib/prisma";
import { householdTz, localParts, toDateColumn } from "@/lib/dates";
import { occurrenceSpanMs } from "@/lib/calendar/repeat-span";
import { timeLabel } from "@/lib/workouts/workout-time";
import { occurrencesIn } from "@/lib/calendar/recur";
import { eventSport, sportKindOf, type SportKind } from "@/lib/sport/label";

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
      eventType: { select: { sport: true, sportWorkout: true, name: true } },
      externalCalendar: { select: { sport: true, sportWorkout: true, userId: true, memberIds: true, name: true } },
    },
    orderBy: { startsAt: "asc" },
  })) as {
    id: string;
    userId: string | null;
    title: string | null;
    startsAt: Date;
    rrule: string | null;
    participants: { userId: string }[];
    eventType: { sport: string | null; sportWorkout: boolean; name: string } | null;
    externalCalendar: { sport: string | null; sportWorkout: boolean; userId: string | null; memberIds: string[] | null; name: string } | null;
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
    if (on) return { eventId: e.id, title: eventSport(e) };
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
      eventType: { select: { sport: true, name: true, sportKind: true } },
      externalCalendar: { select: { sport: true, sportWorkout: true, userId: true, memberIds: true, name: true } },
    },
  })) as {
    id: string;
    userId: string | null;
    title: string | null;
    startsAt: Date;
    rrule: string | null;
    participants: { userId: string }[];
    eventType: { sport: string | null; name: string; sportKind: string | null } | null;
    externalCalendar: { sport: string | null; sportWorkout: boolean; userId: string | null; memberIds: string[] | null; name: string } | null;
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
    const label = eventSport(e);
    const kind = sportKindOf(e.title, e.eventType?.sportKind);
    for (const date of new Set(days)) out.push({ date, label, kind });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** A sport event on one day as its own workout (v0.744): when it runs, and
 *  whether the person went. */
export type DaySport = {
  eventId: string;
  /** The event's title ("Hockey practice", "Stars vs Ducks"). */
  title: string;
  /** The sport ("Hockey", eventSport). */
  label: string;
  /** Minutes from midnight, household time. */
  start: number;
  end: number;
  /** "6:00 AM". */
  startLabel: string;
  endLabel: string;
  /** The event has ended, so "Did you go?" can be answered. */
  ended: boolean;
  state: "open" | "went" | "skipped";
  /** When went: the logged session, its minutes and how it felt. */
  sessionId: string | null;
  minutes: number;
  flexTime: boolean;
  effort: string | null;
  hurt: string | null;
};


/** Every sport event a person is in on a day, in time order (v0.744). Who's
 *  in follows sportOn: the owner, every participant, a sport feed's people. */
export async function sportsForDay(userId: string, dateISO: string): Promise<DaySport[]> {
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
      endsAt: true,
      rrule: true,
      participants: { select: { userId: true } },
      eventType: { select: { sport: true, name: true, sportFlexTime: true } },
      externalCalendar: { select: { sport: true, sportWorkout: true, userId: true, memberIds: true, name: true } },
    },
  })) as {
    id: string;
    userId: string | null;
    title: string | null;
    startsAt: Date;
    endsAt: Date;
    rrule: string | null;
    participants: { userId: string }[];
    eventType: { sport: string | null; name: string; sportFlexTime: boolean } | null;
    externalCalendar: { sport: string | null; sportWorkout: boolean; userId: string | null; memberIds: string[] | null; name: string } | null;
  }[];
  const found: { e: (typeof events)[number]; at: Date; ms: number }[] = [];
  for (const e of events) {
    const mine =
      e.userId === userId ||
      e.participants.some((p) => p.userId === userId) ||
      (!!e.externalCalendar?.sportWorkout &&
        (e.externalCalendar.userId === userId || (e.externalCalendar.memberIds ?? []).includes(userId)));
    if (!mine) continue;
    if (e.rrule) {
      const ms = occurrenceSpanMs(e.startsAt, e.endsAt, false, tz);
      for (const at of occurrencesIn(e.startsAt, e.rrule, dateISO, dateISO, tz)) found.push({ e, at, ms });
    } else if (localParts(e.startsAt, tz).iso === dateISO) {
      found.push({ e, at: e.startsAt, ms: e.endsAt.getTime() - e.startsAt.getTime() });
    }
  }
  if (found.length === 0) return [];
  const ids = found.map((f) => f.e.id);
  const date = toDateColumn(dateISO);
  const [sessions, skips, feel] = (await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, date, sourceEventId: { in: ids } },
      select: { id: true, sourceEventId: true, durationMin: true },
    }),
    prisma.sportSkip.findMany({ where: { userId, date, eventId: { in: ids } }, select: { eventId: true } }),
    prisma.workoutFeedback.findMany({
      where: { userId, date, slot: { in: ids.map((id) => `sport:${id}`) } },
      select: { slot: true, effort: true, hurt: true },
    }),
  ])) as [
    { id: string; sourceEventId: string; durationMin: number | null }[],
    { eventId: string }[],
    { slot: string; effort: string | null; hurt: string | null }[],
  ];
  const now = Date.now();
  return found
    .map(({ e, at, ms }) => {
      const start = localParts(at, tz).minutes;
      const length = Math.max(1, Math.round(ms / 60000));
      const end = start + length;
      const s = sessions.find((x) => x.sourceEventId === e.id);
      const f = feel.find((x) => x.slot === `sport:${e.id}`);
      return {
        eventId: e.id,
        title: e.title?.trim() || e.eventType?.name || eventSport(e),
        label: eventSport(e),
        start,
        end,
        startLabel: timeLabel(start),
        endLabel: timeLabel(end),
        ended: at.getTime() + ms <= now,
        state: s ? "went" : skips.some((k) => k.eventId === e.id) ? "skipped" : "open",
        sessionId: s?.id ?? null,
        minutes: s?.durationMin ?? length,
        flexTime: !!e.eventType?.sportFlexTime,
        effort: f?.effort ?? null,
        hurt: f?.hurt ?? null,
      } satisfies DaySport;
    })
    .sort((a, b) => a.start - b.start);
}

/**
 * The sport of each event a logged sport session came from (v0.745), by event
 * id. A session whose event is gone goes by its own name (sportDayLabel).
 */
export async function sportsOfEvents(ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  if (want.length === 0) return new Map();
  const rows = (await prisma.event.findMany({
    where: { id: { in: want } },
    select: {
      id: true,
      title: true,
      eventType: { select: { name: true, sport: true } },
      externalCalendar: { select: { name: true, sport: true } },
    },
  })) as {
    id: string;
    title: string | null;
    eventType: { name: string; sport: string | null } | null;
    externalCalendar: { name: string; sport: string | null } | null;
  }[];
  return new Map(rows.map((r) => [r.id, eventSport(r)]));
}
