import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, dayOfWeek, toDateColumn, fromDateColumn } from "@/lib/dates";
import { hiitResult, formatHiitMovement, type WorkoutType } from "@/lib/workouts/catalog";
import { clockText } from "@/lib/workouts/timer";

/** The feedback slot for a planned conditioning workout on a day. */
export const hiitSlot = (plannedWorkoutId: string) => `hiit:${plannedWorkoutId}`;

export type ConditioningPlan = {
  plannedWorkoutId: string;
  hiitWorkoutId: string;
  name: string;
  type: WorkoutType;
  /** AMRAP cap / EMOM length / seconds per timed station. */
  capSec: number | null;
  movements: { name: string; reps: number | null; distance: number | null; weight: number | null; line: string }[];
  /** "Rounds", "Time", "Minutes done", "Total reps", and how it's stored. */
  resultLabel: string;
  resultMetric: "REPS" | "DURATION";
  /** Logged on this day ("8 rounds"), the person's last before it, and the
   *  household best with whose it is. */
  today: string | null;
  last: string | null;
  best: { name: string; result: string } | null;
  effort: string | null;
  hurt: string | null;
};

function resultText(type: WorkoutType, reps: number | null, seconds: number | null): string | null {
  const r = hiitResult(type);
  if (r.metric === "DURATION") return seconds ? clockText(seconds) : null;
  if (reps == null) return null;
  if (type === "AMRAP") return `${reps} ${reps === 1 ? "round" : "rounds"}`;
  if (type === "EMOM") return `${reps} min`;
  return `${reps} reps`;
}

/**
 * The day's planned conditioning workouts (named HIIT workouts), with what
 * the timer needs and the results to beat. Results are the HIIT sessions
 * logged under the workout's name, as they always were.
 */
export async function conditioningFor(userId: string, dateISO: string): Promise<ConditioningPlan[]> {
  const plans = (await prisma.plannedWorkout.findMany({
    where: {
      userId,
      dayOfWeek: dayOfWeek(dateISO),
      isRest: false,
      hiitWorkoutId: { not: null },
      createdAt: { lt: toDateColumn(addDays(dateISO, 1)) },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      hiitWorkout: {
        select: {
          id: true,
          name: true,
          type: true,
          capSec: true,
          movements: {
            orderBy: { position: "asc" },
            select: { reps: true, distance: true, weight: true, poolExercise: { select: { name: true } } },
          },
        },
      },
    },
  })) as {
    id: string;
    hiitWorkout: {
      id: string;
      name: string;
      type: WorkoutType;
      capSec: number | null;
      movements: { reps: number | null; distance: number | null; weight: number | null; poolExercise: { name: string } | null }[];
    } | null;
  }[];
  const list = plans.filter((p) => p.hiitWorkout);
  if (list.length === 0) return [];

  // Logged from the web under the workout's name (60 characters), from the
  // phone under the plan's (40): both count.
  const names = [...new Set(list.flatMap((p) => [p.hiitWorkout!.name.slice(0, 60), p.hiitWorkout!.name.slice(0, 40)]))];
  const day = toDateColumn(dateISO);
  const [sessions, feedback] = (await Promise.all([
    prisma.workoutSession.findMany({
      where: { category: "HIIT" as never, isRest: false, name: { in: names } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        userId: true,
        date: true,
        name: true,
        user: { select: { name: true, displayName: true } },
        sets: { orderBy: { setNumber: "asc" }, take: 1, select: { reps: true, seconds: true } },
      },
    }),
    prisma.workoutFeedback.findMany({
      where: { userId, date: day, slot: { in: list.map((p) => hiitSlot(p.id)) } },
      select: { slot: true, effort: true, hurt: true },
    }),
  ])) as [
    {
      userId: string;
      date: Date;
      name: string | null;
      user: { name: string; displayName: string | null } | null;
      sets: { reps: number | null; seconds: number | null }[];
    }[],
    { slot: string; effort: string | null; hurt: string | null }[],
  ];
  const fb = new Map(feedback.map((f) => [f.slot, f]));

  return list.map((p) => {
    const w = p.hiitWorkout!;
    const r = hiitResult(w.type);
    const mine = sessions.filter((s) => (s.name ?? "").slice(0, 40) === w.name.slice(0, 40));
    const val = (s: (typeof mine)[number]) => (r.metric === "DURATION" ? s.sets[0]?.seconds ?? null : s.sets[0]?.reps ?? null);
    const text = (s: (typeof mine)[number] | undefined) => (s ? resultText(w.type, s.sets[0]?.reps ?? null, s.sets[0]?.seconds ?? null) : null);
    const today = mine.find((s) => s.userId === userId && fromDateColumn(s.date) === dateISO);
    const last = mine.find((s) => s.userId === userId && fromDateColumn(s.date) < dateISO && val(s) != null);
    let best: (typeof mine)[number] | undefined;
    for (const s of mine) {
      const v = val(s);
      if (v == null || v <= 0) continue;
      const b = best ? val(best) : null;
      if (b == null || (r.metric === "DURATION" ? v < b : v > b)) best = s;
    }
    const f = fb.get(hiitSlot(p.id));
    return {
      plannedWorkoutId: p.id,
      hiitWorkoutId: w.id,
      name: w.name,
      type: w.type,
      capSec: w.capSec,
      movements: w.movements
        .filter((m) => m.poolExercise)
        .map((m) => ({
          name: m.poolExercise!.name,
          reps: m.reps,
          distance: m.distance,
          weight: m.weight,
          line: formatHiitMovement({ name: m.poolExercise!.name, reps: m.reps, distance: m.distance, weight: m.weight }),
        })),
      resultLabel: r.label,
      resultMetric: r.metric === "DURATION" ? "DURATION" : "REPS",
      today: text(today),
      last: text(last),
      best: best
        ? {
            name: best.userId === userId ? "you" : best.user?.displayName?.trim() || best.user?.name || "",
            result: text(best) ?? "",
          }
        : null,
      effort: f?.effort ?? null,
      hurt: f?.hurt ?? null,
    };
  });
}
