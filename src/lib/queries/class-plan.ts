import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { spreadUnits, type PlanUnit } from "@/lib/school/plan-builder";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDay(iso: string): string {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}

/** No-school days: the dates covered by household PAUSE events (vacations/breaks). */
async function noSchoolDays(): Promise<Set<string>> {
  const pauses = await prisma.event.findMany({
    where: { kind: "PAUSE" },
    select: { startsAt: true, endsAt: true },
  });
  const out = new Set<string>();
  for (const e of pauses) {
    let d = dISO(e.startsAt);
    const end = dISO(e.endsAt);
    while (d <= end) {
      out.add(d);
      d = addDay(d);
    }
  }
  return out;
}

export type PlanRow = {
  id: string;
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
 *  skipping weekends and pause days), for the admin list. */
export async function loadClassPlans(): Promise<PlanRow[]> {
  const [plans, allTerms, holidays] = await Promise.all([
    prisma.classPlan.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        bothTerms: true,
        perDay: true,
        weekdays: true,
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
    noSchoolDays(),
  ]);

  const start = todayISO();
  return plans.map((p) => {
    const windows = p.bothTerms ? allTerms : allTerms.filter((t) => t.id === p.class.termId);
    const terms = windows.map((t) => ({ start: dISO(t.startDate), end: dISO(t.endDate) }));
    const undone: PlanUnit[] = p.units
      .filter((u) => !u.done)
      .map((u) => ({ label: u.label, type: u.type as PlanUnit["type"], load: u.load }));
    const sched = terms.length
      ? spreadUnits(undone, {
          startDate: start,
          weekdays: p.weekdays.split("").map(Number),
          holidays,
          terms,
          perDay: p.perDay,
        })
      : [];
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
      student: p.class.user.name,
      className: p.class.name,
      subject: p.class.subject?.name ?? null,
      term: p.bothTerms ? "Both semesters" : windows[0]?.name ?? "—",
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
