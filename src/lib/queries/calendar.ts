import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, localParts, toDateColumn, weekDays } from "@/lib/dates";
import { CATEGORY_COLORS } from "@/lib/colors";

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
  ownerName: string;
  kind: string;
  calendarName: string | null;
};

export type WeekData = {
  days: string[];
  timed: GridEvent[];
  allDay: GridEvent[];
};

const KIND_TO_CATEGORY: Record<string, keyof typeof CATEGORY_COLORS> = {
  CLASS: "SCHOOL",
  WORK: "WORK",
  APPOINTMENT: "APPOINTMENT",
  EXTERNAL: "OTHER",
  OTHER: "OTHER",
};

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
  userId?: string,
): Promise<GridEvent[]> {
  const people = await prisma.user.findMany({
    where: {
      isActive: true,
      birthday: { not: null },
      ...(userId ? { id: userId } : {}),
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      birthday: true,
    },
  });

  if (people.length === 0) return [];

  const inRange = new Set(days);
  const events: GridEvent[] = [];

  for (const p of people) {
    const born = fromDateColumn(p.birthday!);
    const [bornYear, month, day] = born.split("-");

    // Only the years the range actually touches, so a month view spanning a
    // new year still lands both.
    const years = new Set(days.map((d) => d.slice(0, 4)));

    for (const year of years) {
      const iso = `${year}-${month}-${day}`;
      if (!inRange.has(iso)) continue;

      const turning = Number(year) - Number(bornYear);
      const who = p.displayName ?? p.name;

      events.push({
        id: `birthday-${p.id}-${year}`,
        title:
          turning > 0 ? `${who} turns ${turning}` : `${who}'s birthday`,
        location: null,
        dayISO: iso,
        startMin: 0,
        endMin: 1440,
        timeLabel: "All day",
        allDay: true,
        color: userId ? CATEGORY_COLORS.OTHER : p.color,
        ownerName: who,
        kind: "BIRTHDAY",
        calendarName: null,
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
export async function loadRange(
  days: string[],
  userId?: string,
): Promise<WeekData> {
  const rangeStart = toDateColumn(days[0]);
  const rangeEnd = new Date(
    toDateColumn(days[days.length - 1]).getTime() + 2 * 86_400_000,
  );

  const events = await prisma.event.findMany({
    where: {
      ...(userId ? { userId } : {}),
      startsAt: { lt: rangeEnd },
      endsAt: { gte: rangeStart },
    },
    orderBy: { startsAt: "asc" },
    include: {
      user: { select: { name: true, displayName: true, color: true } },
      externalCalendar: { select: { name: true } },
    },
  });

  const timed: GridEvent[] = [];
  const allDay: GridEvent[] = [];

  for (const e of events) {
    const start = localParts(e.startsAt);
    const end = localParts(e.endsAt);

    if (!days.includes(start.iso) && !days.includes(end.iso)) continue;

    const color = userId
      ? CATEGORY_COLORS[KIND_TO_CATEGORY[e.kind] ?? "OTHER"]
      : e.user.color;

    const base = {
      id: e.id,
      title: e.title,
      location: e.location,
      color,
      ownerName: e.user.displayName ?? e.user.name,
      kind: e.kind as string,
      calendarName: e.externalCalendar?.name ?? null,
    };

    if (e.allDay) {
      allDay.push({
        ...base,
        dayISO: start.iso,
        startMin: 0,
        endMin: 1440,
        timeLabel: "All day",
        allDay: true,
      });
      continue;
    }

    // An event running past midnight is clipped to its starting day rather
    // than split, which keeps the grid readable for late finishes.
    const endMin =
      end.iso === start.iso ? end.minutes : 1440;

    timed.push({
      ...base,
      dayISO: start.iso,
      startMin: start.minutes,
      endMin: Math.max(endMin, start.minutes + 20),
      timeLabel: `${start.label} – ${end.label}`,
      allDay: false,
    });
  }

  allDay.push(...(await birthdayEvents(days, userId)));

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
  userId?: string,
): Promise<DayTask[]> {
  const rows = await prisma.task.findMany({
    where: {
      ...(userId ? { userId } : {}),
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
    color: userId
      ? (CATEGORY_COLORS[t.category as keyof typeof CATEGORY_COLORS] ??
        "#64748b")
      : t.user.color,
  }));
}
