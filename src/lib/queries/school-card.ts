import { prisma } from "@/lib/prisma";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
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
    prisma.term.findMany({ select: { name: true, endDate: true } }),
  ]);

  const spring = terms.find((t) => t.name.toLowerCase().includes("spring"));
  const targetISO = spring
    ? dISO(spring.endDate)
    : terms.length
      ? dISO(terms.reduce((m, t) => (t.endDate > m.endDate ? t : m)).endDate)
      : null;

  const progress: SchoolProgress[] = plans
    .map((p) => {
      const dates = p.units
        .filter((u) => u.scheduledDate)
        .map((u) => dISO(u.scheduledDate as Date))
        .sort();
      const finishISO = dates.length ? dates[dates.length - 1] : null;
      const remaining = p.units.filter((u) => !u.done).length;
      const overflow = p.units.filter((u) => !u.done && !u.scheduledDate).length;
      const onTrack =
        overflow === 0 && (finishISO && targetISO ? finishISO <= targetISO : true);
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
