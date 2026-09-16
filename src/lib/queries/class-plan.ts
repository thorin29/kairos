import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { spreadUnits, spreadUnitsFit, type PlanUnit } from "@/lib/school/plan-builder";
import { noSchoolDaysFor } from "@/lib/school/school-days";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type PlanRow = {
  id: string;
  classId: string;
  student: string;
  className: string;
  subject: string | null;
  term: string;
  status: string;
  total: number;
  done: number;
  remaining: number;
  firstItem: string | null;
  slices: { term: string; count: number; from: string | null; to: string | null }[];
  finish: string | null;
  overflow: number; // items that don't fit before the last term ends
};

/** All class plans with a computed schedule summary (spread across your terms,
 *  skipping weekends, pause days, and holidays), for the admin list. */
export async function loadClassPlans(): Promise<PlanRow[]> {
  const [plans, allTerms] = await Promise.all([
    prisma.classPlan.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        classId: true,
        status: true,
        bothTerms: true,
        perDay: true,
        weekdays: true,
        startDate: true,
        fitToTerm: true,
        class: {
          select: {
            name: true,
            termId: true,
            subject: { select: { name: true } },
            user: { select: { name: true } },
          },
        },
        units: { orderBy: { seq: "asc" }, select: { label: true, type: true, load: true, done: true } },
      },
    }),
    prisma.term.findMany({
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
  ]);

  // One skip set over the union of every term window covers every plan (each
  // plan schedules against all terms or a subset of them).
  const holidays = await noSchoolDaysFor(
    allTerms.map((t) => ({ start: dISO(t.startDate), end: dISO(t.endDate) })),
  );

  const start = todayISO();
  return plans.map((p) => {
    const windows = p.bothTerms ? allTerms : allTerms.filter((t) => t.id === p.class.termId);
    const terms = windows.map((t) => ({ start: dISO(t.startDate), end: dISO(t.endDate) }));
    const undone: PlanUnit[] = p.units
      .filter((u) => !u.done)
      .map((u) => ({ label: u.label, type: u.type as PlanUnit["type"], load: u.load }));
    const planStart = p.startDate ? dISO(p.startDate) : start;
    const planWeekdays = p.weekdays.split("").map(Number);
    const sched = !terms.length
      ? []
      : p.fitToTerm
        ? spreadUnitsFit(undone, { startDate: planStart, weekdays: planWeekdays, holidays, terms })
        : spreadUnits(undone, {
            startDate: planStart,
            weekdays: planWeekdays,
            holidays,
            terms,
            perDay: p.perDay,
          });
    const placed = sched.filter((s) => s.date);
    const slices = windows.map((t) => {
      const s = dISO(t.startDate);
      const e = dISO(t.endDate);
      const items = placed.filter((x) => x.date! >= s && x.date! <= e);
      return {
        term: t.name,
        count: items.length,
        from: items[0]?.date ?? null,
        to: items[items.length - 1]?.date ?? null,
      };
    });
    return {
      id: p.id,
      classId: p.classId,
      student: p.class.user.name,
      className: p.class.name,
      subject: p.class.subject?.name ?? null,
      term: p.bothTerms ? "Both semesters" : windows[0]?.name ?? "\u2014",
      status: p.status,
      total: p.units.length,
      done: p.units.length - undone.length,
      remaining: undone.length,
      firstItem: undone[0]?.label ?? null,
      slices,
      finish: placed.length ? placed[placed.length - 1].date : null,
      overflow: sched.length - placed.length,
    };
  });
}

export type PlanUnitRow = {
  id: string;
  label: string;
  type: "ASSIGNMENT" | "TEST" | "PROJECT";
  load: number;
  done: boolean;
  workId: string | null;
  scheduledDate: string | null;
};

export type PlanDetail = {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  student: string;
  className: string;
  subject: string | null;
  bothTerms: boolean;
  hasTwoTerms: boolean; // whether a "both semesters" toggle is meaningful
  fitToTerm: boolean;
  perDay: number;
  weekdays: number[]; // ISO 1..7
  units: PlanUnitRow[];
  // Context for the client-side live recompute (mirrors the server builder).
  terms: { name: string; start: string; end: string }[];
  allTerms: { name: string; start: string; end: string }[];
  classTerm: { name: string; start: string; end: string } | null; // the class's own single term
  skipDays: string[];
  startDate: string; // today, first candidate school day
};

/** One plan with everything the review/reorder screen needs, including the term
 *  windows + skip days so the client can recompute the spread live as units are
 *  reordered — using the very same builder the server publishes with. */
export async function loadClassPlanDetail(id: string): Promise<PlanDetail | null> {
  const p = await prisma.classPlan.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      bothTerms: true,
      perDay: true,
      weekdays: true,
      startDate: true,
      fitToTerm: true,
      class: {
        select: {
          name: true,
          termId: true,
          subject: { select: { name: true } },
          user: { select: { name: true } },
        },
      },
      units: {
        orderBy: { seq: "asc" },
        select: { id: true, label: true, type: true, load: true, done: true, workId: true, scheduledDate: true },
      },
    },
  });
  if (!p) return null;

  const allTermsRows = await prisma.term.findMany({
    orderBy: { startDate: "asc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  const mapTerm = (t: { name: string; startDate: Date; endDate: Date }) => ({
    name: t.name,
    start: dISO(t.startDate),
    end: dISO(t.endDate),
  });
  const allTerms = allTermsRows.map(mapTerm);
  const classTermRow = allTermsRows.find((t) => t.id === p.class.termId) ?? null;
  const windowRows = p.bothTerms ? allTermsRows : allTermsRows.filter((t) => t.id === p.class.termId);
  const terms = windowRows.map(mapTerm);
  const skip = await noSchoolDaysFor(allTerms);

  return {
    id: p.id,
    status: p.status,
    student: p.class.user.name,
    className: p.class.name,
    subject: p.class.subject?.name ?? null,
    bothTerms: p.bothTerms,
    hasTwoTerms: allTermsRows.length > 1,
    fitToTerm: p.fitToTerm,
    perDay: p.perDay,
    weekdays: p.weekdays.split("").map(Number),
    units: p.units.map((u) => ({
      id: u.id,
      label: u.label,
      type: u.type as PlanUnitRow["type"],
      load: u.load,
      done: u.done,
      workId: u.workId,
      scheduledDate: u.scheduledDate ? dISO(u.scheduledDate) : null,
    })),
    terms,
    allTerms,
    classTerm: classTermRow ? mapTerm(classTermRow) : null,
    skipDays: [...skip],
    startDate: p.startDate ? dISO(p.startDate) : todayISO(),
  };
}
