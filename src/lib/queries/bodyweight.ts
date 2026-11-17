import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn } from "@/lib/dates";
import { dayNumbers } from "@/lib/workouts/lift-stats";

/**
 * Bodyweight movements for the lift charts (v0.734): pull-ups, push-ups, dips
 * — anything logged in reps with no weight. Each day's best set is the point,
 * with that day's total reps and reps a minute; the chart follows reps, as it
 * does for a fixed weight. A movement also logged with weight stays in the
 * weight series and isn't repeated here.
 */
export type BodyweightSeries = {
  id: string;
  name: string;
  muscleGroup: string | null;
  points: {
    date: string;
    value: number;
    reps: null;
    intent: string | null;
    est: null;
    volume: number;
    total: number;
    seconds: number;
    density: number | null;
  }[];
  best: { date: string; value: number; reps: null } | null;
};

export async function bodyweightSeries(userId: string, skip: Set<string>): Promise<BodyweightSeries[]> {
  const sets = (await prisma.sessionSet.findMany({
    where: {
      weight: null,
      reps: { gt: 0 },
      poolExerciseId: { not: null },
      session: { userId, isRest: false },
      poolExercise: { metric: "REPS", muscleGroup: { not: null, notIn: ["CORE"] } },
    },
    select: {
      poolExerciseId: true,
      reps: true,
      seconds: true,
      createdAt: true,
      session: { select: { date: true, completedOn: true, intent: true } },
      poolExercise: { select: { name: true, muscleGroup: true } },
    },
  })) as unknown as {
    poolExerciseId: string;
    reps: number;
    seconds: number | null;
    createdAt: Date;
    session: { date: Date; completedOn: Date | null; intent: string | null };
    poolExercise: { name: string; muscleGroup: string | null };
  }[];
  const by = new Map<string, { name: string; group: string | null; days: Map<string, { sets: typeof sets; intent: string | null }> }>();
  for (const s of sets) {
    if (skip.has(s.poolExerciseId)) continue;
    const day = fromDateColumn(s.session.completedOn ?? s.session.date);
    const m = by.get(s.poolExerciseId) ?? { name: s.poolExercise.name, group: s.poolExercise.muscleGroup, days: new Map() };
    const d = m.days.get(day) ?? { sets: [], intent: null };
    d.sets.push(s);
    d.intent = d.intent ?? s.session.intent;
    m.days.set(day, d);
    by.set(s.poolExerciseId, m);
  }
  return [...by.entries()].map(([id, m]) => {
    const points = [...m.days.entries()]
      .map(([date, d]) => {
        const n = dayNumbers(
          d.sets.map((x) => ({ weight: null, reps: x.reps, seconds: x.seconds, at: x.createdAt })),
          "lb",
        );
        return { date, value: Math.max(...d.sets.map((x) => x.reps)), reps: null, intent: d.intent, ...n, est: null };
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const best = [...points].sort((a, b) => b.value - a.value || (a.date < b.date ? 1 : -1))[0];
    return { id, name: m.name, muscleGroup: m.group, points, best: best ? { date: best.date, value: best.value, reps: null } : null };
  });
}
