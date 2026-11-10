import { routineFor } from "@/lib/workouts/warmup-run";
import { parseWarmupChoice } from "@/lib/workouts/warmup-library";
import { prisma } from "@/lib/prisma";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { cleanPlanScheme } from "@/lib/workouts/programs";
import { todayISO } from "@/lib/dates";
import {
  MUSCLE_GROUP_LABEL,
  CATEGORY_LABEL,
  metricChoicesFor,
  type WorkoutCategory,
  type MuscleGroup,
  type Metric,
} from "@/lib/workouts/catalog";

/** Remove one of the caller's own planned workouts. */
export async function removePlannedWorkoutOwned(
  id: string,
  userId: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  const pw = await prisma.plannedWorkout.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!pw) return "not_found";
  if (pw.userId !== userId) return "forbidden";
  await prisma.plannedWorkout.delete({ where: { id } }).catch(() => {});
  await generateWorkoutTasks();
  return "ok";
}

/** Mark a weekday as a planned rest day (one marker per day). */
export async function addPlannedRestDayCore(
  userId: string,
  day: number,
): Promise<void> {
  if (day < 0 || day > 6) return;
  const existing = await prisma.plannedWorkout.findFirst({
    where: { userId, dayOfWeek: day, isRest: true },
  });
  if (existing) return;
  const count = await prisma.plannedWorkout.count({
    where: { userId, dayOfWeek: day },
  });
  await prisma.plannedWorkout.create({
    data: { userId, dayOfWeek: day, name: "Rest day", isRest: true, sortOrder: count },
  });
  await generateWorkoutTasks();
}

/** Copy a day's workout names to another day (skips duplicates by name). */
export async function copyDayPlanCore(
  userId: string,
  from: number,
  to: number,
): Promise<void> {
  if (from === to || from < 0 || from > 6 || to < 0 || to > 6) return;
  const [source, existing] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId, dayOfWeek: from },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.plannedWorkout.findMany({ where: { userId, dayOfWeek: to } }),
  ]);
  const have = new Set(existing.map((w) => w.name.toLowerCase()));
  let order = existing.length;
  for (const w of source) {
    if (have.has(w.name.toLowerCase())) continue;
    await prisma.plannedWorkout.create({
      data: { userId, dayOfWeek: to, name: w.name, sortOrder: order++ },
    });
  }
  await generateWorkoutTasks();
}


/**
 * Add a workout to a day: movements from the pool (each with an optional set
 * structure), or a Warm-up or Cardio with nothing in it (v0.615). The web's
 * plan builder and the phone's both call this.
 */
export async function addPlannedFromPoolCore(
  userId: string,
  day: number,
  input: {
    category: string;
    muscleGroup?: string | null;
    name?: string;
    exercises: {
      poolExerciseId: string;
      tracked: boolean;
      metric?: string | null;
      /** "same:3x5", "range:3x8-12", "wave"; "" or absent = any sets. */
      scheme?: string | null;
    }[];
    /** A Warm-up's (or Mobility's, v0.659) routine, chosen as it's added (v0.638): "lib:<key>" or one's own id. */
    warmup?: string | null;
  },
): Promise<void> {
  if (day < 0 || day > 6) return;
  let warmup: string | null = null;
  if ((input.category === "WARMUP" || input.category === "MOBILITY" || input.category === "STRETCHING") && input.warmup) {
    // One routine, "match" or a rotation (v0.659: any of them as it's added);
    // every id must be one the person can use.
    const choice = parseWarmupChoice(input.warmup);
    const ids = choice?.mode === "one" ? [choice.id] : choice?.mode === "rotation" ? choice.ids : [];
    let usable = !!choice;
    for (const id of ids) if (!(await routineFor(userId, id))) usable = false;
    warmup = usable ? input.warmup.slice(0, 500) : null;
  }
  if (!(input.category in CATEGORY_LABEL)) return;
  const label = (
    input.name?.trim() ||
    (input.muscleGroup
      ? (MUSCLE_GROUP_LABEL as Record<string, string>)[input.muscleGroup]
      : (CATEGORY_LABEL as Record<string, string>)[input.category])
  ).slice(0, 40);
  const today = todayISO();

  const seen = new Set<string>();
  const rows = input.exercises.filter((e) => {
    if (!e.poolExerciseId || seen.has(e.poolExerciseId)) return false;
    seen.add(e.poolExerciseId);
    return true;
  });

  const fill = await poolMetrics(input.category, rows);
  const count = await prisma.plannedWorkout.count({ where: { userId, dayOfWeek: day } });
  await prisma.plannedWorkout.create({
    data: {
      userId,
      dayOfWeek: day,
      name: label,
      sortOrder: count,
      category: input.category as WorkoutCategory,
      muscleGroup: (input.muscleGroup ?? null) as MuscleGroup | null,
      ...(warmup ? { warmup } : {}),
      exercises: {
        create: rows.map((e, i) => ({
          poolExerciseId: e.poolExerciseId,
          tracked: e.tracked,
          metric: (e.metric ?? fill.get(e.poolExerciseId) ?? null) as Metric | null,
          scheme: input.category === "WEIGHTS" ? cleanPlanScheme(e.scheme, today) : null,
          sortOrder: i,
        })),
      },
    },
  });
  await generateWorkoutTasks();
}

/** Add a named HIIT/CrossFit workout to a day. */
export async function addPlannedHiitCore(
  userId: string,
  day: number,
  hiitWorkoutId: string,
): Promise<"ok" | "not_found"> {
  if (day < 0 || day > 6 || !hiitWorkoutId) return "not_found";
  const w = await prisma.hiitWorkout.findUnique({
    where: { id: hiitWorkoutId },
    select: { name: true },
  });
  if (!w) return "not_found";
  const count = await prisma.plannedWorkout.count({ where: { userId, dayOfWeek: day } });
  await prisma.plannedWorkout.create({
    data: {
      userId,
      dayOfWeek: day,
      name: w.name.slice(0, 40),
      category: "HIIT" as WorkoutCategory,
      hiitWorkoutId,
      sortOrder: count,
    },
  });
  await generateWorkoutTasks();
  return "ok";
}

/**
 * The metric a new plan entry takes when none was chosen: the movement's own
 * "Logs as" setting, if the plan's category allows it (v0.609.0). So a plank
 * added to a weights day is timed without anyone changing it.
 */
export async function poolMetrics(
  category: string,
  rows: readonly { poolExerciseId: string; metric?: string | null }[],
): Promise<Map<string, Metric>> {
  const ids = rows.filter((r) => !r.metric).map((r) => r.poolExerciseId);
  const out = new Map<string, Metric>();
  if (ids.length === 0) return out;
  const allowed = metricChoicesFor(category as WorkoutCategory);
  const pool = await prisma.poolExercise.findMany({
    where: { id: { in: ids } },
    select: { id: true, metric: true },
  });
  for (const p of pool) {
    const m = p.metric as Metric | null;
    if (m && allowed.includes(m)) out.set(p.id, m);
  }
  return out;
}

/**
 * Change one planned movement's set structure (v0.615). "" clears it (any
 * sets); "wave" keeps a wave already running, else starts one today. Only the
 * owner's plans.
 */
export async function setPlannedSchemeCore(
  userId: string,
  plannedWorkoutId: string,
  poolExerciseId: string,
  scheme: string,
): Promise<"ok" | "not_found"> {
  const row = (await prisma.plannedExercise.findFirst({
    where: { plannedWorkoutId, poolExerciseId, plannedWorkout: { userId } },
    select: { id: true, scheme: true, plannedWorkout: { select: { category: true } } },
  })) as { id: string; scheme: string | null; plannedWorkout: { category: string | null } } | null;
  if (!row) return "not_found";
  const next =
    row.plannedWorkout.category === "WEIGHTS" || row.plannedWorkout.category == null
      ? cleanPlanScheme(scheme, todayISO(), row.scheme)
      : null;
  await prisma.plannedExercise.update({ where: { id: row.id }, data: { scheme: next } });
  return "ok";
}
