import "server-only";
import { prisma } from "@/lib/prisma";
import {
  loadRange,
  type GridEvent,
} from "@/lib/queries/calendar";
import { syncStaleCalendars } from "@/lib/calendar/sync";
import {
  addDays,
  addMonths,
  formatMonth,
  monthGridDays,
  startOfMonth,
  startOfWeek,
  weekDays,
} from "@/lib/dates";
import { getFamilyColor } from "@/lib/settings";
import { loadCalendarPrefs, type CalView } from "@/lib/calendar/prefs";
import { recolorForPersonal } from "@/lib/calendar/colors";

/**
 * The read-only "my calendar" the app's Calendar screen paints (Phase 1: Month,
 * Agenda, Day). Mirrors src/app/calendar/personal-calendar.tsx exactly — same
 * saved prefs (view, which people/subscriptions/family/school-work are shown),
 * same filtering, and the same server-side recolour from the person's saved
 * colour choices — but returns JSON instead of rendering. Editing, the options
 * drawer, the time-grid views, and colour controls are later phases.
 */

export type CalEvent = {
  id: string;
  eventId: string;
  title: string;
  location: string | null;
  dayISO: string;
  allDay: boolean;
  startMin: number;
  endMin: number;
  timeLabel: string;
  color: string;
  memberColors: string[];
  isFamily: boolean;
  shade: boolean;
  kind: string;
  ownerName: string;
  calendarName: string | null;
  recurring: boolean;
  recurLabel: string | null;
  external: boolean;
  schoolType: string | null;
  schoolClassName: string | null;
};

export type CalendarPagePayload = {
  today: string;
  view: CalView;
  date: string;
  heading: string;
  /** The ISO days this view covers (month = 42-day grid, week = 7, etc.). */
  rangeDays: string[];
  /** Prev/next anchor dates for this view's paging. */
  prevDate: string;
  nextDate: string;
  events: CalEvent[];
  /** The 42-day month grid containing `date`, for the Month view and the
   *  date-picker on the other views. */
  monthDays: string[];
  /** Up to three distinct colours per day in that month, for dots. */
  monthDots: Record<string, string[]>;
};

/** Heading for a two-ISO span: one month, cross-month, or cross-year. */
function spanHeading(startISO: string, endISO: string): string {
  const sY = startISO.slice(0, 4);
  const eY = endISO.slice(0, 4);
  const sM = startISO.slice(5, 7);
  const eM = endISO.slice(5, 7);
  const abbr = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  if (sY === eY && sM === eM) return formatMonth(startISO);
  if (sY === eY) return `${abbr(startISO)} \u2013 ${abbr(endISO)} ${sY}`;
  return `${abbr(startISO)} ${sY} \u2013 ${abbr(endISO)} ${eY}`;
}

const valid = (v?: string): v is CalView =>
  v === "month" ||
  v === "week" ||
  v === "three_day" ||
  v === "day" ||
  v === "agenda";

function toWire(e: GridEvent): CalEvent {
  return {
    id: e.id,
    eventId: e.eventId,
    title: e.title,
    location: e.location,
    dayISO: e.dayISO,
    allDay: e.allDay,
    startMin: e.startMin,
    endMin: e.endMin,
    timeLabel: e.timeLabel,
    color: e.color,
    memberColors: e.memberColors,
    isFamily: e.isFamily,
    shade: e.shade,
    kind: e.kind,
    ownerName: e.ownerName,
    calendarName: e.calendarName,
    recurring: e.recurring,
    recurLabel: e.recurLabel ?? null,
    external: e.external,
    schoolType: e.schoolType ?? null,
    schoolClassName: e.schoolClassName ?? null,
  };
}

export async function loadCalendarPagePayload(
  userId: string,
  todayISO: string,
  rawView?: string,
  rawDate?: string,
): Promise<CalendarPagePayload> {
  const prefs = await loadCalendarPrefs(userId);
  const view: CalView = valid(rawView) ? rawView : prefs.view;
  const date =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayISO;

  const [subsRaw, familyColor] = await Promise.all([
    prisma.externalCalendar.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, userId: true },
    }),
    getFamilyColor(),
  ]);
  void familyColor;

  // Defaults resolve here, exactly like the web: unset people → just me; unset
  // subscriptions → the ones I own; an explicit empty list means "show none".
  const shownPeople = prefs.shownPeople ?? [userId];
  const shownSubs =
    prefs.shownSubs ?? subsRaw.filter((s) => s.userId === userId).map((s) => s.id);
  const subsSet = new Set(shownSubs);

  const days =
    view === "month"
      ? monthGridDays(date)
      : view === "week"
        ? weekDays(date)
        : view === "three_day"
          ? [date, addDays(date, 1), addDays(date, 2)]
          : [date];

  const stepDate = (n: number) =>
    view === "month"
      ? addMonths(startOfMonth(date), n)
      : view === "week"
        ? addDays(startOfWeek(date), n * 7)
        : view === "three_day"
          ? addDays(date, n * 3)
          : addDays(date, n);

  await syncStaleCalendars();

  const colorPrefs = {
    personalizeColors: prefs.personalizeColors,
    othersMode: prefs.othersMode,
    othersColor: prefs.othersColor,
    holidayColor: prefs.holidayColor,
    kindColors: prefs.kindColors,
    eventTypeColors: prefs.eventTypeColors,
    subColors: prefs.subColors,
  };
  const keep = (e: GridEvent) =>
    (!e.isFamily || prefs.showFamily) &&
    (!e.external ||
      (e.externalCalendarId ? subsSet.has(e.externalCalendarId) : true));
  const recolor = (e: GridEvent) => recolorForPersonal(e, colorPrefs, userId);

  const rawRange = await loadRange(days, shownPeople, prefs.showSchoolWork);
  const timed = rawRange.timed.filter(keep).map(recolor);
  const allDay = rawRange.allDay.filter(keep).map(recolor);
  const events = [...allDay, ...timed].map(toWire);

  // Month grid + dots. When the view already spans the month grid we reuse the
  // events; otherwise load the month separately (matches the web).
  const monthDays = monthGridDays(date);
  const monthDots: Record<string, string[]> = {};
  let forDots: GridEvent[];
  if (view === "month") {
    forDots = [...allDay, ...timed];
  } else {
    const mr = await loadRange(monthDays, shownPeople, prefs.showSchoolWork);
    forDots = [...mr.allDay, ...mr.timed].filter(keep).map(recolor);
  }
  for (const e of forDots) {
    const arr = monthDots[e.dayISO] ?? (monthDots[e.dayISO] = []);
    if (arr.length < 3 && !arr.includes(e.color)) arr.push(e.color);
  }

  const heading =
    view === "month"
      ? formatMonth(date)
      : view === "week"
        ? spanHeading(days[0], days[6])
        : view === "three_day"
          ? spanHeading(days[0], days[2])
          : formatMonth(date);

  return {
    today: todayISO,
    view,
    date,
    heading,
    rangeDays: days,
    prevDate: stepDate(-1),
    nextDate: stepDate(1),
    events,
    monthDays,
    monthDots,
  };
}
