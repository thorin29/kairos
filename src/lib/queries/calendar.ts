import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, localParts, toDateColumn, weekDays } from "@/lib/dates";
import { getFamilyColor } from "@/lib/settings";
import { householdTz } from "@/lib/dates";
import { occurrencesIn } from "@/lib/calendar/recur";

export type GridEvent = {
  id: string;
  title: string;
  location: string | null;
  dayISO: string;
  /** Minutes from midnight in the household timezone. */
  startMin: number;
  endMin: number;
  timeLabel: string;
  allDay: boolean;
  color: string;
  /** True for shared "Family" events (not per-person, not birthdays). */
  isFamily: boolean;
  /** The owner's user id, or null for shared/family events. */
  ownerId: string | null;
  /** Every person this event belongs in a column for: the owner plus any
   *  participants. Empty for family/shared events (they span all columns).
   *  Drives per-person day columns, so a shared event shows in each member's
   *  column and dropping one member removes only their copy. */
  memberIds: string[];
  /** Whether this all-day event tints its day column. */
  shade: boolean;
  ownerName: string;
  kind: string;
  calendarName: string | null;
  /** The underlying row, without the per-occurrence suffix. */
  eventId: string;
  recurring: boolean;
  external: boolean;
};

export type WeekData = {
  days: string[];
  timed: GridEvent[];
  allDay: GridEvent[];
};

export type EventTypeRow = {
  id: string;
  name: string;
  color: string;
  sportWorkout: boolean;
  defaultMinutes: number | null;
};

/** Admin-managed custom event types, in display order. */
export async function loadEventTypes(): Promise<EventTypeRow[]> {
  const rows = await prisma.eventType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      sportWorkout: true,
      defaultMinutes: true,
    },
  });
  return rows as unknown as EventTypeRow[];
}

/**
 * Colour follows the spec: everyone on screen means colour by person, so
 * each child's blocks match their profile. Filter to one person and colour
 * switches to category, identical for every person, so a filtered week reads
 * as school versus work rather than a wall of one hue.
 */
export async function loadWeek(
  anchorISO: string,
  userId?: string,
): Promise<WeekData> {
  return loadRange(weekDays(anchorISO), userId);
}

/** Events for an arbitrary run of days — one, seven, or a whole month grid. */
/**
 * Birthdays are synthesized rather than stored as events.
 *
 * A birthday is a rule — this month and day, every year — so writing rows
 * for it would mean deciding how many years ahead to generate and rewriting
 * them whenever a date is corrected. Building them per range is always
 * right, needs no maintenance, and makes the age arithmetic fall out for
 * free.
 */
async function birthdayEvents(
  days: string[],
  familyColor: string,
): Promise<GridEvent[]> {
  // Birthdays are family-wide: always shown, never filtered out.
  const people = await prisma.user.findMany({
    where: {
      isActive: true,
      birthday: { not: null },
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      birthday: true,
      shadeBirthday: true,
    },
  });

  if (people.length === 0) return [];

  const inRange = new Set(days);
  const events: GridEvent[] = [];

  for (const p of people) {
    const born = fromDateColumn(p.birthday!);
    const [, month, day] = born.split("-");

    // Only the years the range actually touches, so a month view spanning a
    // new year still lands both.
    const years = new Set(days.map((d) => d.slice(0, 4)));

    for (const year of years) {
      const iso = `${year}-${month}-${day}`;
      if (!inRange.has(iso)) continue;

      const who = p.displayName ?? p.name;

      events.push({
        id: `birthday-${p.id}-${year}`,
        title: `${who}'s Birthday`,
        location: null,
        dayISO: iso,
        startMin: 0,
        endMin: 1440,
        timeLabel: "All day",
        allDay: true,
        color: familyColor,
        // Not a "Family filter" event, so isFamily stays false; the day-column
        // wash keys off the BIRTHDAY kind instead, so birthdays still tint.
        isFamily: false,
        ownerId: p.id,
        // Birthdays are all-day and family-wide; all-day events span the top
        // of the day view rather than sitting in a person column, so members
        // are irrelevant here.
        memberIds: [],
        shade: (p as { shadeBirthday?: boolean }).shadeBirthday ?? true,
        ownerName: who,
        kind: "BIRTHDAY",
        calendarName: null,
        // Derived from the profile, not a stored row: nothing to delete.
        eventId: "",
        recurring: true,
        external: false,
      });
    }
  }

  return events;
}

/**
 * Birthdays repeat forever, so storing them as event rows would mean
 * generating one per person per year and maintaining them. Instead they're
 * synthesized for whatever range is being viewed: match on month and day,
 * and the birth year gives the age being turned.
 */
/** Filter by one person, several people, or (undefined) everyone. An empty
 *  array means "nobody selected" and matches no rows. */
function idFilter(
  userId?: string | string[],
): { userId?: string | { in: string[] } } {
  if (userId === undefined) return {};
  if (Array.isArray(userId)) return { userId: { in: userId } };
  return { userId };
}

/** Person events matching the filter, plus family events always. A person's
 *  filter also catches events they merely participate in (a shared workout
 *  owned by someone else), so those still land in their day column. */
function ownerFilter(userId?: string | string[]): object {
  if (userId === undefined) return {};
  const inClause = Array.isArray(userId) ? { in: userId } : userId;
  return {
    OR: [
      { userId: inClause },
      { isFamily: true },
      { participants: { some: { userId: inClause } } },
    ],
  };
}

export async function loadRange(
  days: string[],
  userId?: string | string[],
): Promise<WeekData> {
  const rangeStart = toDateColumn(days[0]);
  const rangeEnd = new Date(
    toDateColumn(days[days.length - 1]).getTime() + 2 * 86_400_000,
  );

  const familyColor = await getFamilyColor();

  const events = await prisma.event.findMany({
    where: {
      AND: [
        ownerFilter(userId),
        {
          OR: [
            // Ordinary events overlapping the window.
            { startsAt: { lt: rangeEnd }, endsAt: { gte: rangeStart } },
            // Repeating ones may have started long before it.
            { rrule: { not: null }, startsAt: { lt: rangeEnd } },
          ],
        },
      ],
    },
    orderBy: { startsAt: "asc" },
    include: {
      user: { select: { name: true, displayName: true, color: true } },
      externalCalendar: { select: { name: true } },
      eventType: { select: { name: true, color: true } },
      participants: { select: { userId: true } },
    },
  });

  const timed: GridEvent[] = [];
  const allDay: GridEvent[] = [];

  const tz = householdTz();

  // Single-occurrence edits detach a child event marked with the original date
  // it overrides. Gather those dates per parent so the series skips them; the
  // child itself renders as an ordinary event (fetched above by overlap), even
  // if it was moved to a different day.
  const overrideRows = await prisma.event.findMany({
    where: {
      recurrenceId: { not: null },
      recurrenceDate: { not: null, gte: rangeStart, lt: rangeEnd },
    },
    select: { recurrenceId: true, recurrenceDate: true },
  });
  const skipDates = new Map<string, Set<string>>();
  for (const r of overrideRows) {
    if (!r.recurrenceId || !r.recurrenceDate) continue;
    const iso = fromDateColumn(r.recurrenceDate);
    const set = skipDates.get(r.recurrenceId) ?? new Set<string>();
    set.add(iso);
    skipDates.set(r.recurrenceId, set);
  }

  for (const e of events) {
    // A repeating event contributes one entry per occurrence in range;
    // everything else contributes itself.
    const starts =
      e.rrule && !e.externalCalendarId
        ? occurrencesIn(
            e.startsAt,
            e.rrule,
            days[0],
            days[days.length - 1],
            tz,
          )
        : [e.startsAt];

    const skip = e.rrule ? skipDates.get(e.id) : undefined;

    const durationMs = e.endsAt.getTime() - e.startsAt.getTime();

    for (const occurrenceStart of starts) {
      // Occurrence replaced by a single-occurrence edit — the child renders it.
      if (skip && skip.has(localParts(occurrenceStart).iso)) continue;
      addOccurrence(e, occurrenceStart, durationMs);
    }
  }

  function addOccurrence(
    e: (typeof events)[number],
    startsAt: Date,
    durationMs: number,
  ) {
    const start = localParts(startsAt);
    const end = localParts(new Date(startsAt.getTime() + durationMs));

    // A custom event type sets its own colour (a "Hockey game" is that colour
    // for everyone); otherwise it's the owner's colour, or the family colour
    // for shared events.
    const eventType = (e as { eventType?: { name: string; color: string } | null })
      .eventType;
    const color = eventType?.color
      ? eventType.color
      : e.isFamily
        ? familyColor
        : (e.user?.color ?? familyColor);

    const suffix = e.rrule ? `-${start.iso}` : "";

    // Everyone whose column this event belongs in: the owner plus participants.
    // Family/shared events span all columns, so they carry no members.
    const participantIds =
      (e as { participants?: { userId: string }[] }).participants?.map(
        (p) => p.userId,
      ) ?? [];
    const memberIds = e.isFamily
      ? []
      : Array.from(new Set([...(e.userId ? [e.userId] : []), ...participantIds]));

    const base = {
      id: `${e.id}${suffix}`,
      title: e.title,
      location: e.location,
      color,
      isFamily: e.isFamily,
      ownerId: e.isFamily ? null : (e.userId ?? null),
      memberIds,
      shade: (e as { shadeDay?: boolean }).shadeDay ?? true,
      ownerName: e.isFamily
        ? "Family"
        : (e.user?.displayName ?? e.user?.name ?? "Family"),
      kind: eventType?.name ?? (e.kind as string),
      calendarName: e.externalCalendar?.name ?? null,
      eventId: e.id,
      recurring: Boolean(e.rrule),
      external: Boolean(e.externalCalendarId),
    };

    if (e.allDay) {
      // An all-day event covers every day from its start through the day before
      // its exclusive end (a one-day event stays on its single day). Each day
      // gets its own entry so a multi-day event (a vacation) shows and shades
      // across its whole span.
      const lastISO = localParts(
        new Date(startsAt.getTime() + durationMs - 1),
      ).iso;
      for (const d of days) {
        if (d < start.iso || d > lastISO) continue;
        allDay.push({
          ...base,
          id: `${base.id}-${d}`,
          dayISO: d,
          startMin: 0,
          endMin: 1440,
          timeLabel: "All day",
          allDay: true,
        });
      }
      return;
    }

    // An event running past midnight is split into one segment per day it
    // touches, so the tail shows on the next day instead of being cut off.
    // Each segment is clipped to its own day; the label keeps the true span.
    // The last day occupied is the day holding the final instant (an event
    // ending at exactly midnight belongs to the day before, not the next).
    const lastISO = localParts(
      new Date(startsAt.getTime() + durationMs - 1),
    ).iso;

    for (const d of days) {
      if (d < start.iso || d > lastISO) continue;
      const segStart = d === start.iso ? start.minutes : 0;
      const segEnd = d === end.iso ? end.minutes : 1440;
      timed.push({
        ...base,
        id: `${base.id}-${d}`,
        dayISO: d,
        startMin: segStart,
        endMin: Math.max(segEnd, segStart + 20),
        timeLabel: `${start.label} – ${end.label}`,
        allDay: false,
      });
    }
  }

  allDay.push(...(await birthdayEvents(days, familyColor)));

  return { days, timed, allDay };
}

/** Everything on one day, for the dashboard strip and the day view. */
export async function loadDaySchedule(dayISO: string, userId?: string) {
  const { timed, allDay } = await loadRange([dayISO], userId);
  return {
    timed: timed.filter((e) => e.dayISO === dayISO),
    allDay: allDay.filter((e) => e.dayISO === dayISO),
  };
}

export type DayTask = {
  id: string;
  title: string;
  category: string;
  dayISO: string;
  status: string;
  ownerName: string;
  color: string;
};

/**
 * Untimed work for the same week, shown beside the schedule. These have no
 * duration so they can't sit on the grid, but they're half of what a day
 * actually holds.
 */
export async function loadWeekTasks(
  anchorISO: string,
  userId?: string,
): Promise<DayTask[]> {
  return loadTasksForDays(weekDays(anchorISO), userId);
}

export async function loadTasksForDays(
  days: string[],
  userId?: string | string[],
): Promise<DayTask[]> {
  const rows = await prisma.task.findMany({
    where: {
      ...idFilter(userId),
      isOpen: false,
      dueDate: {
        gte: toDateColumn(days[0]),
        lte: toDateColumn(days[days.length - 1]),
      },
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
    include: {
      user: { select: { name: true, displayName: true, color: true } },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category as string,
    dayISO: fromDateColumn(t.dueDate),
    status: t.status as string,
    ownerName: t.user.displayName ?? t.user.name,
    // Always the owner's colour, so you can tell whose event it is even when
    // several people are shown at once.
    color: t.user.color,
  }));
}
