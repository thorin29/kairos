import { prisma } from "@/lib/prisma";

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

export type SchoolProgress = {
  className: string;
  subject: string | null;
  color: string | null;
  finishISO: string | null; // last scheduled day at the current pace
  remaining: number; // undone units
  overflow: number; // undone units that don't fit before the term ends
  onTrack: boolean; // finishes on or before the target and nothing overflows
};
export type SchoolProgressData = {
  targetISO: string | null; // the finish-by date (end of Spring)
  progress: SchoolProgress[];
};

/** Per published class for a student: the projected finish date at the current
 *  pace, vs the household finish-by target (end of Spring). Drives the School
 *  card's progress + get-ahead nudge. */
export async function loadSchoolProgress(userId: string): Promise<SchoolProgressData> {
  const [plans, terms] = await Promise.all([
    prisma.classPlan.findMany({
      where: { status: "PUBLISHED", class: { userId } },
      orderBy: { createdAt: "asc" },
      select: {
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
      const dates = p.units
        .filter((u) => u.scheduledDate)
        .map((u) => dISO(u.scheduledDate as Date))
        .sort();
      const lastScheduled = dates.length ? dates[dates.length - 1] : null;
      const remaining = p.units.filter((u) => !u.done).length;
      const overflow = p.units.filter((u) => !u.done && !u.scheduledDate).length;

      // Projected finish: the last scheduled day, plus any overflow projected
      // forward on weekdays (so a class that won't fit shows a real late date).
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

      return {
        className: p.class.name,
        subject: p.class.subject?.name ?? null,
        color: p.class.color,
        finishISO,
        remaining,
        overflow,
        onTrack,
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className));

  return { targetISO, progress };
}
