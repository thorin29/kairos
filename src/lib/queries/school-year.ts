import { prisma } from "@/lib/prisma";
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
  scheduledDays: string[]; // dated units (class color)
  overflowDays: string[]; // projected days past the term end (red)
};
export type StudentBars = { studentId: string; studentName: string; bars: ClassBar[] };

const BAR_PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c",
  "#0891b2", "#c026d3", "#65a30d", "#e11d48", "#0d9488",
];
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
            subject: { select: { name: true } },
          },
        },
        units: { select: { scheduledDate: true, done: true } },
      },
    }),
    prisma.term.findMany({ orderBy: { startDate: "asc" }, select: { id: true, endDate: true } }),
  ]);

  const maxEnd = allTerms.reduce((m, t) => (dISO(t.endDate) > m ? dISO(t.endDate) : m), "");
  const byStudent = new Map<string, StudentBars>();
  let ci = 0;

  for (const p of plans) {
    const st = p.class.user;
    const bucket: StudentBars =
      byStudent.get(st.id) ?? { studentId: st.id, studentName: st.name, bars: [] };
    byStudent.set(st.id, bucket);

    const termEnd = p.bothTerms
      ? maxEnd
      : dISO(allTerms.find((t) => t.id === p.class.termId)?.endDate ?? new Date(0)) || maxEnd;

    const scheduledDays = p.units
      .filter((u) => u.scheduledDate)
      .map((u) => dISO(u.scheduledDate as Date));
    const overflowCount = p.units.filter((u) => !u.done && !u.scheduledDate).length;

    const overflowDays: string[] = [];
    let d = termEnd ? addDayISO(termEnd) : "";
    while (d && overflowDays.length < overflowCount) {
      if (dowOf(d) <= 5) overflowDays.push(d);
      d = addDayISO(d);
    }

    bucket.bars.push({
      className: p.class.name,
      subject: p.class.subject?.name ?? null,
      color: p.class.color || BAR_PALETTE[ci % BAR_PALETTE.length],
      scheduledDays,
      overflowDays,
    });
    ci += 1;
  }

  return [...byStudent.values()].sort((a, b) => a.studentName.localeCompare(b.studentName));
}
