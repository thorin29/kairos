import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDayISO(iso: string): string {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}
function isoDow(iso: string): number {
  const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return wd === 0 ? 7 : wd;
}
/** School days (weekdays in `set`) in [a, b] inclusive. Rough — ignores holidays. */
function countSchoolDays(a: string, b: string, set: Set<number>): number {
  if (!a || !b || b < a) return 0;
  let n = 0;
  let d = a;
  while (d <= b) {
    if (set.has(isoDow(d))) n += 1;
    d = addDayISO(d);
  }
  return n;
}

export type SchoolProgress = {
  className: string;
  subject: string | null;
  color: string | null;
  finishISO: string | null; // projected finish at the current pace
  remaining: number; // undone units
  overflow: number;
  onTrack: boolean; // projected to finish on or before the target
  pace: "ahead" | "behind" | null; // vs where the plan expects them by today
  catchUpDays: number | null; // school days needing an extra lesson to finish on time
};
export type SchoolProgressData = {
  targetISO: string | null; // the finish-by date (end of Spring)
  progress: SchoolProgress[];
};

/** Per published class for a student: projected finish vs the finish-by target,
 *  whether they're ahead/behind pace, and how many catch-up days a behind class
 *  needs. Drives the School card. */
export async function loadSchoolProgress(userId: string): Promise<SchoolProgressData> {
  const today = todayISO();
  const [plans, terms] = await Promise.all([
    prisma.classPlan.findMany({
      where: { status: "PUBLISHED", class: { userId } },
      orderBy: { createdAt: "asc" },
      select: {
        perDay: true,
        weekdays: true,
        startDate: true,
        class: { select: { name: true, color: true, subject: { select: { name: true } } } },
        units: { select: { scheduledDate: true, done: true } },
      },
    }),
    prisma.term.findMany({ select: { name: true, startDate: true, endDate: true } }),
  ]);

  const spring = terms.find((t) => t.name.toLowerCase().includes("spring"));
  const targetISO = spring
    ? dISO(spring.endDate)
    : terms.length
      ? dISO(terms.reduce((m, t) => (t.endDate > m.endDate ? t : m)).endDate)
      : null;
  const lastTermEnd = terms.length
    ? dISO(terms.reduce((m, t) => (t.endDate > m.endDate ? t : m)).endDate)
    : null;

  const progress: SchoolProgress[] = plans
    .map((p) => {
      const weekdays = new Set<number>(p.weekdays.split("").map(Number));
      const perDay = Math.max(1, p.perDay);
      const dates = p.units
        .filter((u) => u.scheduledDate)
        .map((u) => dISO(u.scheduledDate as Date))
        .sort();
      const lastScheduled = dates.length ? dates[dates.length - 1] : null;
      const doneCount = p.units.filter((u) => u.done).length;
      const remaining = p.units.filter((u) => !u.done).length;
      const overflow = p.units.filter((u) => !u.done && !u.scheduledDate).length;

      // Projected finish: last scheduled day, plus overflow projected on weekdays.
      let finishISO = lastScheduled;
      if (overflow > 0) {
        let d = lastScheduled ?? lastTermEnd ?? null;
        let left = overflow;
        while (d && left > 0) {
          d = addDayISO(d);
          if (isoDow(d) <= 5) {
            finishISO = d;
            left -= 1;
          }
        }
      }
      const onTrack = finishISO && targetISO ? finishISO <= targetISO : true;

      // Pace: done vs how many the plan expected done by today (from its start).
      const firstDate = p.startDate ? dISO(p.startDate) : dates[0] ?? null;
      let pace: "ahead" | "behind" | null = null;
      if (firstDate && firstDate <= today) {
        const elapsed = countSchoolDays(firstDate, today, weekdays);
        const expected = Math.min(elapsed * perDay, p.units.length);
        const diff = doneCount - expected;
        pace = diff >= 2 ? "ahead" : diff <= -2 ? "behind" : null;
      }

      // Catch-up: if it won't fit, how many school days need an extra lesson.
      let catchUpDays: number | null = null;
      if (!onTrack && targetISO && today <= targetISO) {
        const available = countSchoolDays(addDayISO(today), targetISO, weekdays);
        if (remaining > available) catchUpDays = remaining - available;
      }

      return {
        className: p.class.name,
        subject: p.class.subject?.name ?? null,
        color: p.class.color,
        finishISO,
        remaining,
        overflow,
        onTrack,
        pace,
        catchUpDays,
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className));

  return { targetISO, progress };
}
