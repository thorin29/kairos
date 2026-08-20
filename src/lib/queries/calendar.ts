import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, localParts, toDateColumn, weekDays } from "@/lib/dates";
import { getFamilyColor } from "@/lib/settings";
import { householdTz } from "@/lib/dates";
import { occurrencesIn } from "@/lib/calendar/recur";
import { CATEGORY_COLORS } from "@/lib/colors";
import { getHolidayColor, holidayEntries } from "@/lib/holidays";
import { bgKeyForKind, bgKeyForHoliday } from "@/lib/event-bg";

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
  /** Distinct profile colours of everyone on the event (owner + participants),
   *  for shared events. Zero or one entry means "not shared" — render `color`.
   *  Two or more means paint bands or a blend of these. */
  memberColors: string[];
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
  /** A short human recurrence label ("Weekly", "Yearly"…) or null for one-offs,
   *  for the event detail popup. */
  recurLabel?: string | null;
  external: boolean;
  /** Set on synthesized school-work due markers; the work type, for the glyph
   *  and colour. Null/absent on ordinary events. */
  schoolType?: string | null;
  /** On a class meeting block: one entry per student in the class with pending
   *  work due that day, for the little "work is due" badges. Absent otherwise. */
  schoolBadges?: { userId: string; type: string }[];
  /** Background-image key (see lib/event-bg). Null/absent = colour only. */
  bgKey?: string | null;
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
        memberColors: [],
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
        bgKey: "birthday",
        calendarName: null,
        // Derived from the profile, not a stored row: nothing to delete.
        eventId: "",
        recurring: true,
        recurLabel: "Yearly",
        external: false,
      });
    }
  }

  return events;
}

/** Enabled US/Texas holidays as family-wide all-day items, computed for the
 *  years the range touches. Read-only (no stored row), one shared colour. */
async function holidayEvents(days: string[]): Promise<GridEvent[]> {
  const entries = await holidayEntries(days);
  if (entries.length === 0) return [];
  const color = await getHolidayColor();
  return entries.map((h) => ({
    id: `holiday-${h.key}-${h.iso}`,
    title: h.label,
    location: null,
    dayISO: h.iso,
    startMin: 0,
    endMin: 1440,
    timeLabel: "All day",
    allDay: true,
    color,
    memberColors: [],
    isFamily: false,
    ownerId: "",
    memberIds: [],
    shade: false,
    ownerName: "Holiday",
    kind: "HOLIDAY",
    bgKey: bgKeyForHoliday(h.key),
    calendarName: null,
    eventId: "",
    recurring: true,
    recurLabel: "Yearly",
    external: false,
  }));
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
  includeSchoolWork = false,
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
        // Tombstones for a deleted single occurrence never render; they only
        // exist so the parent series skips their date.
        { cancelled: false },
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
      participants: { select: { userId: true, user: { select: { color: true } } } },
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

    // Distinct profile colours of everyone on a shared event (owner +
    // participants). Two or more → the block paints their colours; otherwise the
    // single `color` above is used.
    const participantColors =
      (e as { participants?: { user?: { color?: string } | null }[] })
        .participants?.map((p) => p.user?.color)
        .filter((c): c is string => Boolean(c)) ?? [];
    const memberColors = e.isFamily
      ? []
      : Array.from(
          new Set(
            [e.user?.color, ...participantColors].filter((c): c is string =>
              Boolean(c),
            ),
          ),
        );

    const base = {
      id: `${e.id}${suffix}`,
      title: e.title,
      location: e.location,
      color,
      memberColors,
      isFamily: e.isFamily,
      ownerId: e.isFamily ? null : (e.userId ?? null),
      memberIds,
      shade: (e as { shadeDay?: boolean }).shadeDay ?? true,
      ownerName: e.isFamily
        ? "Family"
        : (e.user?.displayName ?? e.user?.name ?? "Family"),
      kind: eventType?.name ?? (e.kind as string),
      bgKey: bgKeyForKind(eventType?.name ?? (e.kind as string)),
      calendarName: e.externalCalendar?.name ?? null,
      eventId: e.id,
      recurring: Boolean(e.rrule),
      recurLabel: recurLabelOf(e.rrule),
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
  allDay.push(...(await holidayEvents(days)));

  if (includeSchoolWork) {
    const marks = await applySchoolWork(days, userId, timed);
    for (const m of marks) {
      if (m.allDay) allDay.push(m);
      else timed.push(m);
    }
  }

  return { days, timed, allDay };
}

/** Format minutes-from-midnight as a clock label (e.g. 870 → "2:30 PM"). */
function minuteLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

/** A short human recurrence label from an rrule's FREQ, or null for one-offs. */
function recurLabelOf(rrule: string | null): string | null {
  if (!rrule) return null;
  const m = /FREQ=([A-Z]+)/.exec(rrule);
  switch (m?.[1]) {
    case "DAILY":
      return "Daily";
    case "WEEKLY":
      return "Weekly";
    case "MONTHLY":
      return "Monthly";
    case "YEARLY":
      return "Yearly";
    default:
      return "Repeats";
  }
}

/**
 * Pending school work placed on the calendar by due date. Work due on a day
 * its class meets rides that class's meeting block as a small per-student badge
 * (one icon per student with work due, dropping off as each is completed),
 * rather than stacking separate blocks on the same time. Everything else — no
 * class, or a class that doesn't meet that day — shows as its own marker
 * (timed if it has a due time, else an all-day chip). One shared colour;
 * respects the person filter; behind the calendar's "School work" filter.
 *
 * Mutates `timedEvents` to attach badges to class blocks, and returns the
 * standalone markers to append.
 */
async function applySchoolWork(
  days: string[],
  userId: string | string[] | undefined,
  timedEvents: GridEvent[],
): Promise<GridEvent[]> {
  const rangeStart = toDateColumn(days[0]);
  const rangeEndExclusive = new Date(
    toDateColumn(days[days.length - 1]).getTime() + 86_400_000,
  );
  const daySet = new Set(days);

  const userWhere =
    userId === undefined
      ? {}
      : Array.isArray(userId)
        ? { userId: { in: userId } }
        : { userId };

  const tasks = await prisma.task.findMany({
    where: {
      category: "SCHOOL",
      status: "PENDING",
      dueDate: { gte: rangeStart, lt: rangeEndExclusive },
      schoolWork: { isNot: null },
      ...userWhere,
    },
    select: {
      id: true,
      title: true,
      userId: true,
      dueDate: true,
      user: { select: { name: true, displayName: true } },
      schoolWork: {
        select: {
          type: true,
          dueMinutes: true,
          class: { select: { eventId: true } },
        },
      },
    },
  });

  // Index the class meeting blocks already on the grid by event + day, so a
  // work item due on a meeting day can ride that block instead of stacking.
  const classBlocks = new Map<string, GridEvent>();
  for (const ev of timedEvents) {
    if (ev.kind === "CLASS") classBlocks.set(`${ev.eventId}|${ev.dayISO}`, ev);
  }

  // When a student has several items on one class block, show one badge with
  // the "highest" type (a test outranks a project, an assignment, homework).
  const rank: Record<string, number> = {
    TEST: 0,
    PROJECT: 1,
    ASSIGNMENT: 2,
    HOMEWORK: 3,
  };
  const badges = new Map<string, Map<string, string>>();

  const color = CATEGORY_COLORS.SCHOOL;
  const markers: GridEvent[] = [];

  for (const t of tasks) {
    const dueISO = fromDateColumn(t.dueDate);
    if (!daySet.has(dueISO)) continue;
    const sw = t.schoolWork;
    if (!sw) continue;

    const classEventId = sw.class?.eventId ?? null;
    const key = classEventId ? `${classEventId}|${dueISO}` : null;

    // Rides the class block if that class actually meets that day.
    if (key && classBlocks.has(key)) {
      let perStudent = badges.get(key);
      if (!perStudent) {
        perStudent = new Map<string, string>();
        badges.set(key, perStudent);
      }
      const existing = perStudent.get(t.userId);
      if (existing === undefined || rank[sw.type] < rank[existing]) {
        perStudent.set(t.userId, sw.type);
      }
      continue;
    }

    // Otherwise it's a standalone marker.
    const ownerName = t.user?.displayName ?? t.user?.name ?? "";
    const markerBase = {
      title: t.title,
      location: null,
      color,
      memberColors: [],
      isFamily: false,
      ownerId: t.userId,
      memberIds: [t.userId],
      shade: false,
      ownerName,
      kind: "SCHOOLWORK",
      calendarName: null,
      eventId: t.id,
      recurring: false,
      recurLabel: null,
      external: false,
      schoolType: sw.type as string,
    };

    if (sw.dueMinutes == null) {
      markers.push({
        ...markerBase,
        id: `sw-${t.id}`,
        dayISO: dueISO,
        startMin: 0,
        endMin: 1440,
        timeLabel: "Due",
        allDay: true,
      });
    } else {
      const start = Math.max(0, Math.min(1439, sw.dueMinutes));
      markers.push({
        ...markerBase,
        id: `sw-${t.id}`,
        dayISO: dueISO,
        startMin: start,
        endMin: Math.min(1440, start + 30),
        timeLabel: `Due ${minuteLabel(start)}`,
        allDay: false,
      });
    }
  }

  // Attach the per-student badges to their class blocks.
  for (const [key, perStudent] of badges) {
    const block = classBlocks.get(key);
    if (!block) continue;
    block.schoolBadges = Array.from(perStudent.entries()).map(
      ([uid, type]) => ({ userId: uid, type }),
    );
  }

  return markers;
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
