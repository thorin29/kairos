import { prisma } from "@/lib/prisma";
import { holidayEntries } from "@/lib/holidays";
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

  const holidays = (await holidayEntries(enumerateDays(start, end))).map((h) => ({
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
