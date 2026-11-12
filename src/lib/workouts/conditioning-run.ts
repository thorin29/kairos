import "server-only";
import { planDow } from "@/lib/workouts/day-swap-run";
import { prisma } from "@/lib/prisma";
import { addDays, dayOfWeek, toDateColumn, fromDateColumn } from "@/lib/dates";
import { hiitResult, formatHiitMovement, type WorkoutType } from "@/lib/workouts/catalog";
import { hasScaled, versionMoves } from "@/lib/workouts/wod-library";
import { readScaled, resultText, versionFor, type MoveLine, type Version } from "@/lib/workouts/wod-run";

/** The feedback slot for a planned conditioning workout on a day. */
export const hiitSlot = (plannedWorkoutId: string) => `hiit:${plannedWorkoutId}`;

export type ConditioningPlan = {
  plannedWorkoutId: string;
  hiitWorkoutId: string;
  name: string;
  type: WorkoutType;
  /** AMRAP cap / EMOM length / seconds per timed station. */
  capSec: number | null;
  movements: MoveLine[];
  /** The Scaled version's movements, when it differs (v0.617). */
  scaled: MoveLine[] | null;
  about: string | null;
  /** The version to start on: today's if logged, else the person's default. */
  version: Version;
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

/**
 * The day's planned conditioning workouts (named HIIT workouts), with what
 * the timer needs and the results to beat. Results are the HIIT sessions
 * logged under the workout's name, as they always were.
 */
export async function conditioningFor(userId: string, dateISO: string): Promise<ConditioningPlan[]> {
  const plans = (await prisma.plannedWorkout.findMany({
    where: {
      userId,
      dayOfWeek: await planDow(userId, dateISO),
      isRest: false,
      hiitWorkoutId: { not: null },
      createdAt: { lt: toDateColumn(addDays(dateISO, 1)) },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      hiitWorkout: { select: HIIT_FOR_PLAN },
    },
  })) as { id: string; hiitWorkout: HiitForPlan | null }[];
  return conditioningPlansOf(userId, dateISO, plans);
}

/** What a conditioning card needs of a workout. */
export const HIIT_FOR_PLAN = {
  id: true,
  name: true,
  type: true,
  capSec: true,
  about: true,
  scaled: true,
  movements: {
    orderBy: { position: "asc" as const },
    select: { reps: true, distance: true, weight: true, poolExercise: { select: { name: true } } },
  },
};
export type HiitForPlan = {
  id: string;
  name: string;
  type: WorkoutType;
  capSec: number | null;
  about: string | null;
  scaled: unknown;
  movements: { reps: number | null; distance: number | null; weight: number | null; poolExercise: { name: string } | null }[];
};

/** Conditioning cards for workouts on a day, each under its own id (a plan's,
 *  or a family WOD's, v0.679). */
export async function conditioningPlansOf(
  userId: string,
  dateISO: string,
  plans: { id: string; hiitWorkout: HiitForPlan | null }[],
): Promise<ConditioningPlan[]> {
  const list = plans.filter((p) => p.hiitWorkout);
  if (list.length === 0) return [];

  // Logged from the web under the workout's name (60 characters), from the
  // phone under the plan's (40): both count.
  const names = [...new Set(list.flatMap((p) => [p.hiitWorkout!.name.slice(0, 60), p.hiitWorkout!.name.slice(0, 40)]))];
  const day = toDateColumn(dateISO);
  const [sessions, feedback, version] = (await Promise.all([
    prisma.workoutSession.findMany({
      where: { category: "HIIT" as never, isRest: false, name: { in: names } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        userId: true,
        date: true,
        name: true,
        version: true,
        user: { select: { name: true, displayName: true } },
        sets: { orderBy: { setNumber: "asc" }, take: 1, select: { reps: true, seconds: true } },
      },
    }),
    prisma.workoutFeedback.findMany({
      where: { userId, date: day, slot: { in: list.map((p) => hiitSlot(p.id)) } },
      select: { slot: true, effort: true, hurt: true },
    }),
    versionFor(userId, dateISO),
  ])) as [
    {
      userId: string;
      date: Date;
      name: string | null;
      version: string | null;
      user: { name: string; displayName: string | null } | null;
      sets: { reps: number | null; seconds: number | null }[];
    }[],
    { slot: string; effort: string | null; hurt: string | null }[],
    Version,
  ];
  const fb = new Map(feedback.map((f) => [f.slot, f]));

  return list.map((p) => {
    const w = p.hiitWorkout!;
    const r = hiitResult(w.type);
    const mine = sessions.filter((s) => (s.name ?? "").slice(0, 40) === w.name.slice(0, 40));
    const val = (s: (typeof mine)[number]) => (r.metric === "DURATION" ? s.sets[0]?.seconds ?? null : s.sets[0]?.reps ?? null);
    const text = (s: (typeof mine)[number] | undefined) =>
      s ? resultText(w.type, s.sets[0]?.reps ?? null, s.sets[0]?.seconds ?? null, s.version) : null;
    const today = mine.find((s) => s.userId === userId && fromDateColumn(s.date) === dateISO);
    const last = mine.find((s) => s.userId === userId && fromDateColumn(s.date) < dateISO && val(s) != null);
    let best: (typeof mine)[number] | undefined;
    for (const s of mine) {
      // The household best is an Rx one.
      if (s.version === "SCALED") continue;
      const v = val(s);
      if (v == null || v <= 0) continue;
      const b = best ? val(best) : null;
      if (b == null || (r.metric === "DURATION" ? v < b : v > b)) best = s;
    }
    const f = fb.get(hiitSlot(p.id));
    const moves = w.movements
      .filter((m) => m.poolExercise)
      .map((m) => ({ name: m.poolExercise!.name, reps: m.reps, distance: m.distance, weight: m.weight }));
    const scaled = readScaled(w.scaled, moves.length);
    const withLine = (list: typeof moves) => list.map((m) => ({ ...m, line: formatHiitMovement(m) }));
    return {
      plannedWorkoutId: p.id,
      hiitWorkoutId: w.id,
      name: w.name,
      type: w.type,
      capSec: w.capSec,
      movements: withLine(moves),
      scaled: hasScaled(moves, scaled) ? withLine(versionMoves(moves, scaled, "SCALED")) : null,
      about: w.about,
      version: today?.version === "SCALED" || today?.version === "RX" ? today.version : version,
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
