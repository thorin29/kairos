import { prisma } from "@/lib/prisma";
import { noSchoolDaysFor } from "@/lib/school/school-days";
import { pickClassColor } from "@/lib/palette";
import { getHolidayColor } from "@/lib/holidays";
import {
  holidayEntries,
  schoolClosedHolidayEntries,
  getSchoolClosedHolidayKeys,
} from "@/lib/holidays";
import { localParts } from "@/lib/dates";

function addDayISO(iso: string): string {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}
function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  while (d <= end) {
    out.push(d);
    d = addDayISO(d);
  }
  return out;
}

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
/** Whole weeks a date range spans, inclusive (rounded). */
export function weeksBetween(startISO: string, endISO: string): number {
  if (!startISO || !endISO || endISO < startISO) return 0;
  const a = new Date(`${startISO}T00:00:00Z`).getTime();
  const b = new Date(`${endISO}T00:00:00Z`).getTime();
  const days = Math.round((b - a) / 86400000) + 1;
  return Math.round(days / 7);
}

export type YearTerm = { id: string; name: string; start: string; end: string };
export type YearBreak = { id: string; name: string; start: string; end: string };

export type SchoolYear = {
  fall: YearTerm | null;
  spring: YearTerm | null;
  summer: YearTerm | null;
  breaks: YearBreak[];
  // Convenience for the wizard's live summary.
  fallWeeks: number;
  springWeeks: number;
  summerWeeks: number;
  totalWeeks: number;
  /** The gap between fall end and spring start, if any (the winter break). */
  winterBreak: { start: string; end: string; days: number } | null;
  /** Enabled holidays that fall in the year, for the no-school picker. */
  holidayOptions: { key: string; name: string; iso: string }[];
  /** Which holiday keys are currently marked no-school. */
  schoolClosedKeys: string[];
};

function classify(name: string): "fall" | "spring" | "summer" | null {
  const n = name.toLowerCase();
  if (n.includes("fall") || n.includes("autumn")) return "fall";
  if (n.includes("spring")) return "spring";
  if (n.includes("summer")) return "summer";
  return null;
}

export async function loadSchoolYear(): Promise<SchoolYear> {
  const [terms, breaks] = await Promise.all([
    prisma.term.findMany({
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
    prisma.schoolBreak.findMany({
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
  ]);

  const pick = (kind: "fall" | "spring" | "summer"): YearTerm | null => {
    const t = terms.find((x) => classify(x.name) === kind);
    return t ? { id: t.id, name: t.name, start: dISO(t.startDate), end: dISO(t.endDate) } : null;
  };
  const fall = pick("fall");
  const spring = pick("spring");
  const summer = pick("summer");

  const fallWeeks = fall ? weeksBetween(fall.start, fall.end) : 0;
  const springWeeks = spring ? weeksBetween(spring.start, spring.end) : 0;
  const summerWeeks = summer ? weeksBetween(summer.start, summer.end) : 0;

  let winterBreak: SchoolYear["winterBreak"] = null;
  if (fall && spring && spring.start > fall.end) {
    winterBreak = {
      start: fall.end,
      end: spring.start,
      days: weeksBetween(fall.end, spring.start) === 0 ? 0 : Math.round(
        (new Date(`${spring.start}T00:00:00Z`).getTime() - new Date(`${fall.end}T00:00:00Z`).getTime()) /
          86400000,
      ) - 1,
    };
  }

  // Enabled holidays within the school year, for the no-school picker.
  const allStarts = [fall, spring, summer].filter(Boolean) as YearTerm[];
  let holidayOptions: { key: string; name: string; iso: string }[] = [];
  if (allStarts.length) {
    const rStart = allStarts.reduce((m, t) => (t.start < m ? t.start : m), allStarts[0].start);
    const rEnd = allStarts.reduce((m, t) => (t.end > m ? t.end : m), allStarts[0].end);
    const seen = new Set<string>();
    for (const h of await holidayEntries(enumerateDays(rStart, rEnd))) {
      if (seen.has(h.key)) continue;
      seen.add(h.key);
      holidayOptions.push({ key: h.key, name: h.label, iso: h.iso });
    }
    holidayOptions = holidayOptions.sort((a, b) => a.iso.localeCompare(b.iso));
  }
  const schoolClosedKeys = [...(await getSchoolClosedHolidayKeys())];

  return {
    fall,
    spring,
    summer,
    breaks: breaks.map((b) => ({ id: b.id, name: b.name, start: dISO(b.startDate), end: dISO(b.endDate) })),
    fallWeeks,
    springWeeks,
    summerWeeks,
    totalWeeks: fallWeeks + springWeeks + summerWeeks,
    winterBreak,
    holidayOptions,
    schoolClosedKeys,
  };
}

export type CalTerm = {
  name: string;
  kind: "fall" | "spring" | "summer" | "other";
  start: string;
  end: string;
};
export type CalBlock = { name: string; start: string; end: string };
export type YearCalendar = {
  hasYear: boolean;
  rangeStart: string;
  rangeEnd: string;
  finalDay: string; // last day of the school year (latest term end)
  terms: CalTerm[];
  holidays: { iso: string; name: string }[];
  vacations: CalBlock[]; // confirmed vacation PAUSE events
  plannedBreaks: CalBlock[]; // estimated breaks (planning only)
};

/** Everything the month-strip calendar needs: term windows, enabled holidays
 *  (with names), confirmed vacations, and planned breaks — over the full span of
 *  the school year. Event instants are resolved to household-local days. */
export async function loadYearCalendar(): Promise<YearCalendar> {
  const terms = await prisma.term.findMany({
    orderBy: { startDate: "asc" },
    select: { name: true, startDate: true, endDate: true },
  });
  if (terms.length === 0) {
    return {
      hasYear: false,
      rangeStart: "",
      rangeEnd: "",
      finalDay: "",
      terms: [],
      holidays: [],
      vacations: [],
      plannedBreaks: [],
    };
  }
  const start = dISO(terms[0].startDate);
  const end = terms.reduce((m, t) => (dISO(t.endDate) > m ? dISO(t.endDate) : m), dISO(terms[0].endDate));

  const [breaks, pauses] = await Promise.all([
    prisma.schoolBreak.findMany({ select: { name: true, startDate: true, endDate: true } }),
    prisma.event.findMany({
      where: { kind: "PAUSE" },
      select: { title: true, startsAt: true, endsAt: true },
    }),
  ]);

  const plannedBreaks = breaks
    .map((b) => ({ name: b.name, start: dISO(b.startDate), end: dISO(b.endDate) }))
    .filter((b) => b.end >= start && b.start <= end);

  // All-day PAUSE events store an exclusive end; the last covered day is the
  // household-local day of (end − 1ms). Match how the family calendar renders.
  const vacations = pauses
    .map((p) => ({
      name: p.title || "Vacation",
      start: localParts(p.startsAt).iso,
      end: localParts(new Date(p.endsAt.getTime() - 1)).iso,
    }))
    .filter((b) => b.end >= b.start && b.end >= start && b.start <= end);

  const holidays = (await schoolClosedHolidayEntries(enumerateDays(start, end))).map((h) => ({
    iso: h.iso,
    name: h.label,
  }));

  return {
    hasYear: true,
    rangeStart: start,
    rangeEnd: end,
    finalDay: end,
    terms: terms.map((t) => ({
      name: t.name,
      kind: classify(t.name) ?? "other",
      start: dISO(t.startDate),
      end: dISO(t.endDate),
    })),
    holidays,
    vacations,
    plannedBreaks,
  };
}

export type ClassBar = {
  className: string;
  subject: string | null;
  color: string;
  scheduledDays: string[]; // dated units (class colour up to term end, red past it)
  overflowDays: string[]; // projected days past the term end (red)
  termEnd: string; // the class's term end — days after this are "past term end"
};
export type StudentBars = { studentId: string; studentName: string; bars: ClassBar[] };

function dowOf(s: string): number {
  const wd = new Date(`${s}T00:00:00Z`).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** Per student, one bar per published class: the days it's scheduled (its color)
 *  and any overflow projected past the term end (red). Powers the calendar's
 *  per-class overlay. */
export async function loadStudentBars(): Promise<StudentBars[]> {
  const [plans, allTerms] = await Promise.all([
    prisma.classPlan.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
      select: {
        bothTerms: true,
        class: {
          select: {
            name: true,
            color: true,
            termId: true,
            user: { select: { id: true, name: true } },
            subject: { select: { name: true, sortOrder: true, createdAt: true } },
          },
        },
        units: { select: { scheduledDate: true, done: true } },
      },
    }),
    prisma.term.findMany({ orderBy: { startDate: "asc" }, select: { id: true, endDate: true } }),
  ]);

  const maxEnd = allTerms.reduce((m, t) => (dISO(t.endDate) > m ? dISO(t.endDate) : m), "");
  // No-school days across the overflow horizon (past the last term), so projected
  // overflow lands on real school days — same weekend + holiday/vacation logic as
  // in-term scheduling.
  let noSchool = new Set<string>();
  if (maxEnd) {
    const he = new Date(`${maxEnd}T00:00:00Z`);
    he.setUTCMonth(he.getUTCMonth() + 8);
    const horizonEnd = he.toISOString().slice(0, 10);
    noSchool = await noSchoolDaysFor([{ start: maxEnd, end: horizonEnd }]);
  }
  const holidayColor = await getHolidayColor();

  const buildOverflow = (termEnd: string, count: number): string[] => {
    const days: string[] = [];
    let d = termEnd ? addDayISO(termEnd) : "";
    let guard = 0;
    while (d && days.length < count && guard < 500) {
      if (dowOf(d) <= 5 && !noSchool.has(d)) days.push(d);
      d = addDayISO(d);
      guard += 1;
    }
    return days;
  };

  // Group plans per student, so each student's classes can be ordered the same
  // way (by the shared subject order — the overlay list shouldn't reshuffle when
  // you switch students) and coloured independently of the other students.
  const grouped = new Map<string, { student: { id: string; name: string }; plans: typeof plans }>();
  for (const p of plans) {
    const st = p.class.user;
    const g = grouped.get(st.id) ?? { student: st, plans: [] as typeof plans };
    g.plans.push(p);
    grouped.set(st.id, g);
  }

  const out: StudentBars[] = [];
  for (const { student, plans: sp } of grouped.values()) {
    const ordered = [...sp].sort((a, b) => {
      const oa = a.class.subject?.sortOrder ?? 0;
      const ob = b.class.subject?.sortOrder ?? 0;
      if (oa !== ob) return oa - ob;
      // Imported subjects all sit at sortOrder 0, so fall back to when the
      // subject was first set up (its creation order) before the name.
      const ca = a.class.subject?.createdAt?.getTime() ?? 0;
      const cb = b.class.subject?.createdAt?.getTime() ?? 0;
      if (ca !== cb) return ca - cb;
      const na = a.class.subject?.name ?? "";
      const nb = b.class.subject?.name ?? "";
      if (na !== nb) return na.localeCompare(nb);
      return a.class.name.localeCompare(b.class.name);
    });

    // A class's own colour wins; any class still without one (older imports)
    // gets the next distinct non-reserved palette colour, so a student's classes
    // never share a colour and never land on a reserved calendar colour.
    const used = ordered.map((p) => p.class.color).filter((c): c is string => !!c);

    const bars: ClassBar[] = ordered.map((p) => {
      const termEnd = p.bothTerms
        ? maxEnd
        : dISO(allTerms.find((t) => t.id === p.class.termId)?.endDate ?? new Date(0)) || maxEnd;
      const scheduledDays = p.units
        .filter((u) => u.scheduledDate)
        .map((u) => dISO(u.scheduledDate as Date));
      const overflowCount = p.units.filter((u) => !u.done && !u.scheduledDate).length;

      let color = p.class.color;
      if (!color) {
        color = pickClassColor(used, [holidayColor]);
        used.push(color);
      }

      return {
        className: p.class.name,
        subject: p.class.subject?.name ?? null,
        color,
        scheduledDays,
        overflowDays: buildOverflow(termEnd, overflowCount),
        termEnd,
      };
    });

    out.push({ studentId: student.id, studentName: student.name, bars });
  }

  return out.sort((a, b) => a.studentName.localeCompare(b.studentName));
}

export type BreakReminder = { id: string; name: string; start: string; end: string };

/** Planned breaks starting within the horizon that aren't confirmed and aren't
 *  already covered by a real vacation — the admin should confirm or cancel them
 *  before they arrive. */
export async function loadBreakReminders(
  today: string,
  horizonDays = 14,
): Promise<BreakReminder[]> {
  const lim = new Date(`${today}T00:00:00Z`);
  lim.setUTCDate(lim.getUTCDate() + horizonDays);
  const limit = lim.toISOString().slice(0, 10);

  const breaks = await prisma.schoolBreak.findMany({
    where: { confirmed: false },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  const upcoming = breaks
    .map((b) => ({ id: b.id, name: b.name, start: dISO(b.startDate), end: dISO(b.endDate) }))
    .filter((b) => b.start >= today && b.start <= limit);
  if (upcoming.length === 0) return [];

  const pauses = await prisma.event.findMany({
    where: { kind: "PAUSE" },
    select: { startsAt: true, endsAt: true },
  });
  const pauseRanges = pauses.map((p) => ({
    start: localParts(p.startsAt).iso,
    end: localParts(new Date(p.endsAt.getTime() - 1)).iso,
  }));
  const covered = (b: { start: string; end: string }) =>
    pauseRanges.some((pr) => pr.start <= b.start && pr.end >= b.end);

  return upcoming.filter((b) => !covered(b)).sort((a, b) => a.start.localeCompare(b.start));
}

export type VacationPrompt = { eventId: string; title: string; start: string; end: string };

/** Vacations (PAUSE events) that touch the school year and haven't been decided
 *  yet — the admin should choose whether school shifts around them or runs
 *  through. Past vacations are ignored. */
export async function loadVacationPrompts(today: string): Promise<VacationPrompt[]> {
  const terms = await prisma.term.findMany({ select: { startDate: true, endDate: true } });
  if (terms.length === 0) return [];
  const winStart = terms.reduce((m, t) => (dISO(t.startDate) < m ? dISO(t.startDate) : m), dISO(terms[0].startDate));
  const winEnd = terms.reduce((m, t) => (dISO(t.endDate) > m ? dISO(t.endDate) : m), dISO(terms[0].endDate));

  const [pauses, decided] = await Promise.all([
    prisma.event.findMany({ where: { kind: "PAUSE" }, select: { id: true, title: true, startsAt: true, endsAt: true } }),
    prisma.schoolVacationDecision.findMany({ select: { eventId: true } }),
  ]);
  const decidedIds = new Set(decided.map((d) => d.eventId));

  return pauses
    .map((p) => ({
      eventId: p.id,
      title: p.title || "Vacation",
      start: localParts(p.startsAt).iso,
      end: localParts(new Date(p.endsAt.getTime() - 1)).iso,
    }))
    .filter(
      (p) =>
        !decidedIds.has(p.eventId) &&
        p.end >= today && // not entirely in the past
        p.start <= winEnd &&
        p.end >= winStart, // overlaps the school year
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}
