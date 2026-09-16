import { prisma } from "@/lib/prisma";

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
