"use server";

import { revalidatePath } from "next/cache";
import { logPlannedWorkout, logMovementSets, type MovementSetIn } from "@/lib/workouts/mark";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { setSetting, WORKOUT_OVERDUE_DAYS, WORKOUT_OVERDUE_MAX } from "@/lib/settings";
import { toDateColumn, todayISO } from "@/lib/dates";
import {
  loadOverdueWorkoutDates,
  loadDayLogState,
  loadMovementLog,
  loadWeekStrip,
  type DayLogState,
  type MovementLog,
  type WeekStripDay,
} from "@/lib/queries/workout-log";
import { topSet } from "@/lib/workouts/sets";
import { loadExercisePool, type PoolEntry } from "@/lib/queries/workouts";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { poolMetrics } from "@/lib/workouts/plan-edit";
import {
  CATEGORY_LABEL,
  MUSCLE_GROUP_LABEL,
  WORKOUT_TYPE_LABEL,
  formatHiitMovement,
  hiitResult,
  isHoldName,
  metricChoicesFor,
  poolMetricFor,
  weightUnitKey,
  type Implement,
  type Metric,
  type MuscleGroup,
  type WeightUnit,
  type WorkoutCategory,
  type WorkoutType,
} from "@/lib/workouts/catalog";
import {
  settleWorkoutTask,
  setMovementSkipped,
  logCustomEntry,
  skipWorkoutTask,
  findOrCreateSession,
  setWorkedOut,
  setRestDay,
  logWorkoutSession,
} from "@/lib/workouts/mark";

function refresh() {
  revalidatePath("/exercise");
  revalidatePath("/admin/exercise");
  revalidatePath("/");
}

/**
 * How many days a missed workout keeps showing as overdue before it expires.
 * Clamped to 0..WORKOUT_OVERDUE_MAX; at the top of the range it lives until the
 * same weekday's workout comes due again. Household-wide.
 */
export async function setWorkoutOverdueDays(days: number): Promise<void> {
  await requireAdmin();
  const n = Math.max(0, Math.min(WORKOUT_OVERDUE_MAX, Math.round(days)));
  await setSetting(WORKOUT_OVERDUE_DAYS, String(n));
  refresh();
}

// --- admin ---------------------------------------------------------------

/** The weekly plan's start date (a future day to begin a new/edited plan on).
 *  Stored per-user in settings; empty means "active now" (default). */
export async function setWeeklyStart(userId: string, dateISO: string): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId) return;
  const clean = /^\d{4}-\d{2}-\d{2}$/.test(dateISO) ? dateISO : "";
  await setSetting(`weeklyStart:${userId}`, clean);
  await generateWorkoutTasks();
  refresh();
}

/** Pause or resume the weekly plan (so it can run alongside a rotation, or be
 *  turned off without deleting it). */
export async function setWeeklyActive(userId: string, active: boolean): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId) return;
  await setSetting(`weeklyActive:${userId}`, active ? "1" : "0");
  await generateWorkoutTasks();
  refresh();
}

export async function setWeightUnit(
  muscleGroup: MuscleGroup,
  unit: WeightUnit,
): Promise<void> {
  await requireAdmin();
  await setSetting(weightUnitKey(muscleGroup), unit === "kg" ? "kg" : "lb");
  refresh();
}

// --- exercises (per person, from the shared screen) ----------------------

export async function addExercise(
  userId: string,
  input: {
    name: string;
    category: WorkoutCategory;
    implement?: Implement | null;
    unit: string;
    metric?: Metric;
    tracked?: boolean;
  },
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  const name = input.name.trim().slice(0, 60);
  if (!userId || name.length < 1) return;

  const count = await prisma.exercise.count({ where: { userId } });
  await prisma.exercise.create({
    data: {
      userId,
      name,
      category: input.category,
      implement: input.implement ?? null,
      unit: input.unit.trim().slice(0, 8) || "lb",
      metric: input.metric ?? "WEIGHT",
      tracked: input.tracked ?? true,
      sortOrder: count,
    },
  });
  refresh();
}

export async function updateExercise(
  id: string,
  data: { name?: string; unit?: string; tracked?: boolean; implement?: Implement | null },
): Promise<void> {
  await requireInteractive();
  const ex = await prisma.exercise.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!ex) return;
  await requireCanActFor(ex.userId);
  await prisma.exercise.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim().slice(0, 60) } : {}),
      ...(data.unit !== undefined ? { unit: data.unit.trim().slice(0, 8) } : {}),
      ...(data.tracked !== undefined ? { tracked: data.tracked } : {}),
      ...(data.implement !== undefined ? { implement: data.implement } : {}),
    },
  });
  refresh();
}

export async function removeExercise(id: string): Promise<void> {
  await requireInteractive();
  const ex = await prisma.exercise.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!ex) return;
  await requireCanActFor(ex.userId);
  await prisma.exercise.update({ where: { id }, data: { isActive: false } });
  refresh();
}

/** Admin cleanup: permanently delete an exercise definition and everything
 *  under it (its schedule and any logged sets). For erroneous/test records. */
export async function adminDeleteExercise(id: string): Promise<void> {
  await requireAdmin();
  if (!id) return;
  await prisma.exercise.delete({ where: { id } }).catch(() => {});
  await generateWorkoutTasks();
  refresh();
}

// --- exercise pool (admin-managed, household-wide) -----------------------

/** Add a movement to the shared pool. Muscle group applies to weights only;
 *  duplicates (same category + name) are silently ignored. */
export async function addPoolExercise(input: {
  category: WorkoutCategory;
  name: string;
  muscleGroup?: MuscleGroup | null;
}): Promise<void> {
  await requireAdmin();
  const name = input.name.trim().slice(0, 60);
  if (!name) return;
  const muscleGroup =
    input.category === "WEIGHTS" ? input.muscleGroup ?? null : null;
  const count = await prisma.poolExercise.count({
    where: { category: input.category },
  });
  // A hold is timed from the start, so a plank never asks for weight.
  const metric: Metric | null =
    isHoldName(name) && metricChoicesFor(input.category).includes("DURATION") ? "DURATION" : null;
  await prisma.poolExercise
    .create({
      data: { category: input.category, name, muscleGroup, sortOrder: count, metric },
    })
    .catch(() => {});
  refresh();
}

/**
 * Set how a pool movement is logged (null = the category's default). Every
 * plan entry for it that was on the old setting moves to the new one; an entry
 * someone set differently keeps its own. Returns how many plan entries moved.
 */
export async function setPoolExerciseMetric(id: string, metric: Metric | null): Promise<number> {
  await requireAdmin();
  const p = await prisma.poolExercise.findUnique({
    where: { id },
    select: { category: true, metric: true },
  });
  if (!p) return 0;
  const category = p.category as WorkoutCategory;
  if (metric && !metricChoicesFor(category).includes(metric)) return 0;
  const prev = poolMetricFor(category, p.metric as Metric | null);
  const next = poolMetricFor(category, metric);
  await prisma.poolExercise.update({ where: { id }, data: { metric } });
  let moved = 0;
  if (prev !== next) {
    const r = await prisma.plannedExercise.updateMany({
      where: { poolExerciseId: id, OR: [{ metric: null }, { metric: prev }] },
      data: { metric: next },
    });
    moved = r.count;
  }
  refresh();
  return moved;
}

export async function renamePoolExercise(
  id: string,
  name: string,
): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return;
  await prisma.poolExercise
    .update({ where: { id }, data: { name: clean } })
    .catch(() => {});
  refresh();
}

export async function deletePoolExercise(id: string): Promise<void> {
  await requireAdmin();
  if (!id) return;
  await prisma.poolExercise.delete({ where: { id } }).catch(() => {});
  refresh();
}

export async function setPoolExerciseActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  await requireAdmin();
  if (!id) return;
  await prisma.poolExercise
    .update({ where: { id }, data: { isActive } })
    .catch(() => {});
  refresh();
}

// --- schedule ------------------------------------------------------------

/** Set exactly which weekdays an exercise recurs on (reconciles the rows). */
export async function setScheduleDays(
  exerciseId: string,
  userId: string,
  weekdays: number[],
  startISO?: string,
  endISO?: string | null,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  const days = [...new Set(weekdays)].filter((d) => d >= 0 && d <= 6);
  const effectiveFrom = toDateColumn(
    startISO && /^\d{4}-\d{2}-\d{2}$/.test(startISO) ? startISO : todayISO(),
  );
  const endDate =
    endISO && /^\d{4}-\d{2}-\d{2}$/.test(endISO) ? toDateColumn(endISO) : null;

  const existing = await prisma.workoutSchedule.findMany({ where: { exerciseId } });
  const have = new Set(existing.map((s) => s.dayOfWeek));

  const toAdd = days.filter((d) => !have.has(d));
  const toRemove = existing.filter((s) => !days.includes(s.dayOfWeek)).map((s) => s.id);

  if (toRemove.length > 0) {
    await prisma.workoutSchedule.deleteMany({ where: { id: { in: toRemove } } });
  }
  for (const dayOfWeek of toAdd) {
    await prisma.workoutSchedule.create({
      data: { exerciseId, userId, dayOfWeek, effectiveFrom, endDate },
    });
  }
  // Keep dates/pauses in step for the days that stayed.
  await prisma.workoutSchedule.updateMany({
    where: { exerciseId, dayOfWeek: { in: days } },
    data: { effectiveFrom, endDate, isActive: true },
  });

  await generateWorkoutTasks();
  refresh();
}

export async function pauseExercise(
  exerciseId: string,
  paused: boolean,
): Promise<void> {
  await requireInteractive();
  const pex = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { userId: true },
  });
  if (!pex) return;
  await requireCanActFor(pex.userId);
  await prisma.workoutSchedule.updateMany({
    where: { exerciseId },
    data: { isPaused: paused },
  });
  await generateWorkoutTasks();
  refresh();
}

export async function setExerciseEnd(
  exerciseId: string,
  endISO: string | null,
): Promise<void> {
  await requireInteractive();
  const eex = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { userId: true },
  });
  if (!eex) return;
  await requireCanActFor(eex.userId);
  const endDate =
    endISO && /^\d{4}-\d{2}-\d{2}$/.test(endISO) ? toDateColumn(endISO) : null;
  await prisma.workoutSchedule.updateMany({
    where: { exerciseId },
    data: { endDate },
  });
  await generateWorkoutTasks();
  refresh();
}

// --- logging -------------------------------------------------------------

// completeWorkoutTask, skipWorkoutTask, and findOrCreateSession now live in
// @/lib/workouts/mark (imported above) so the mobile API shares the exact same
// logic.

export type LogEntry = {
  exerciseId: string;
  weight?: number | null;
  reps?: number | null;
  distance?: number | null;
  meters?: number | null;
  seconds?: number | null;
  unit?: string | null;
  finished?: boolean;
};

export async function logSession(input: {
  userId: string;
  dateISO: string;
  entries: LogEntry[];
  finished?: boolean;
  notes?: string;
}): Promise<void> {
  await requireInteractive();
  await requireCanActFor(input.userId);
  if (!input.userId || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) return;
  await logWorkoutSession(input.userId, input.dateISO, input.entries, {
    finished: input.finished,
    notes: input.notes,
  });
  refresh();
}

/** Quick yes/no with no detail: yes logs an (empty) session and completes the
 *  task; no clears the day's session if it has nothing recorded. */
export async function markWorkedOut(
  userId: string,
  dateISO: string,
  worked: boolean,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;
  await setWorkedOut(userId, dateISO, worked);
  refresh();
}

/** Manually close a missed/overdue workout (SKIPPED): it stops showing as
 *  pending or overdue and no longer counts, for the case where the plan
 *  changed so it will never come due again on its own. */
export async function expireWorkoutTask(
  userId: string,
  dateISO: string,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;
  await skipWorkoutTask(userId, dateISO);
  refresh();
}

// --- workout plan (named workouts per weekday) ---------------------------

export async function addPlannedWorkout(
  userId: string,
  dayOfWeek: number,
  name: string,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  const clean = name.trim().slice(0, 40);
  if (!userId || clean.length < 1 || dayOfWeek < 0 || dayOfWeek > 6) return;

  const count = await prisma.plannedWorkout.count({ where: { userId, dayOfWeek } });
  await prisma.plannedWorkout.create({
    data: { userId, dayOfWeek, name: clean, sortOrder: count },
  });
  await generateWorkoutTasks();
  refresh();
}

export async function removePlannedWorkout(id: string): Promise<void> {
  await requireInteractive();
  const pw = await prisma.plannedWorkout.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!pw) return;
  await requireCanActFor(pw.userId);
  await prisma.plannedWorkout.delete({ where: { id } }).catch(() => {});
  await generateWorkoutTasks();
  refresh();
}

/**
 * Create a structured planned workout from the shared pool: a category
 * (weights carry a muscle group), plus the chosen pool movements and, per
 * movement, whether a metric should be logged on completion and which one.
 * Metric-only categories (run/row/ruck) carry no movements — the day itself
 * is the workout and the metric is implied.
 */
export async function addPlannedWorkoutFromPool(
  userId: string,
  dayOfWeek: number,
  input: {
    category: WorkoutCategory;
    muscleGroup?: MuscleGroup | null;
    name?: string;
    exercises: {
      poolExerciseId: string;
      tracked: boolean;
      metric?: Metric | null;
    }[];
  },
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId || dayOfWeek < 0 || dayOfWeek > 6) return;

  const label = (
    input.name?.trim() ||
    (input.muscleGroup
      ? MUSCLE_GROUP_LABEL[input.muscleGroup]
      : CATEGORY_LABEL[input.category])
  ).slice(0, 40);

  // De-dupe within this workout; the [plannedWorkoutId, poolExerciseId] unique
  // is the backstop.
  const seen = new Set<string>();
  const rows = input.exercises.filter((e) => {
    if (!e.poolExerciseId || seen.has(e.poolExerciseId)) return false;
    seen.add(e.poolExerciseId);
    return true;
  });

  const fill = await poolMetrics(input.category, rows);
  const count = await prisma.plannedWorkout.count({ where: { userId, dayOfWeek } });
  await prisma.plannedWorkout.create({
    data: {
      userId,
      dayOfWeek,
      name: label,
      sortOrder: count,
      category: input.category,
      muscleGroup: input.muscleGroup ?? null,
      exercises: {
        create: rows.map((e, i) => ({
          poolExerciseId: e.poolExerciseId,
          tracked: e.tracked,
          metric: e.metric ?? fill.get(e.poolExerciseId) ?? null,
          sortOrder: i,
        })),
      },
    },
  });
  await generateWorkoutTasks();
  refresh();
}

/** Copy a day's named workouts onto another day, skipping ones already there. */
export async function copyDayPlan(
  userId: string,
  fromDay: number,
  toDay: number,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId || fromDay === toDay) return;

  const [source, existing] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId, dayOfWeek: fromDay },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.plannedWorkout.findMany({ where: { userId, dayOfWeek: toDay } }),
  ]);

  const have = new Set(existing.map((w) => w.name.toLowerCase()));
  let order = existing.length;
  for (const w of source) {
    if (have.has(w.name.toLowerCase())) continue;
    await prisma.plannedWorkout.create({
      data: { userId, dayOfWeek: toDay, name: w.name, sortOrder: order++ },
    });
  }
  await generateWorkoutTasks();
  refresh();
}

/** A deliberate rest/skip day: mark the day handled, but flag it so it won't
 *  count toward scoring later. */
export async function addPlannedHiitWorkout(
  userId: string,
  dayOfWeek: number,
  hiitWorkoutId: string,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId || dayOfWeek < 0 || dayOfWeek > 6 || !hiitWorkoutId) return;
  const w = await prisma.hiitWorkout.findUnique({
    where: { id: hiitWorkoutId },
    select: { name: true },
  });
  if (!w) return;
  const count = await prisma.plannedWorkout.count({ where: { userId, dayOfWeek } });
  await prisma.plannedWorkout.create({
    data: {
      userId,
      dayOfWeek,
      name: w.name.slice(0, 40),
      category: "HIIT",
      hiitWorkoutId,
      sortOrder: count,
    },
  });
  await generateWorkoutTasks();
  refresh();
}

export async function addPlannedRestDay(
  userId: string,
  dayOfWeek: number,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId || dayOfWeek < 0 || dayOfWeek > 6) return;
  const existing = await prisma.plannedWorkout.findFirst({
    where: { userId, dayOfWeek, isRest: true },
  });
  if (existing) return; // one rest marker per day is enough
  const count = await prisma.plannedWorkout.count({ where: { userId, dayOfWeek } });
  await prisma.plannedWorkout.create({
    data: { userId, dayOfWeek, name: "Rest day", isRest: true, sortOrder: count },
  });
  await generateWorkoutTasks();
  refresh();
}

export async function restDay(userId: string, dateISO: string): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;
  await setRestDay(userId, dateISO);
  refresh();
}

/** Skip or un-skip one planned movement for a day. A skip counts as done for
 *  that movement; the day completes once every movement is logged or skipped.
 *  `poolExerciseId` empty skips a plan logged as one result (HIIT). */
export async function skipMovement(input: {
  userId: string;
  dateISO: string;
  plannedWorkoutId: string;
  poolExerciseId: string;
  skipped: boolean;
}): Promise<void> {
  await requireInteractive();
  await requireCanActFor(input.userId);
  if (!input.userId || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) return;
  await setMovementSkipped(
    input.userId,
    input.dateISO,
    input.plannedWorkoutId,
    input.poolExerciseId,
    input.skipped,
  );
  refresh();
}

/**
 * The movement pool, for the swap picker. Fetched when the dialog opens rather
 * than threaded through every screen that renders a plan, since swapping is
 * rare and the list is only wanted once someone asks for it.
 */
export async function listExercisePool(): Promise<PoolEntry[]> {
  await requireInteractive();
  return loadExercisePool();
}

/**
 * Complete a scheduled (planned) workout for the day. Writes one named session
 * for the plan with a pool-referenced set per logged metric, then marks the
 * day's workout task done. Untracked movements need no number — completing the
 * workout with no entries still counts the day as worked out.
 */
export async function completePlannedWorkout(input: {
  userId: string;
  dateISO: string;
  plannedWorkoutId: string;
  entries: {
    poolExerciseId: string | null;
    metric: Metric;
    value: number;
    unit: string;
    /** Reps for a WEIGHT entry; the record is still the weight. */
    reps?: number | null;
    /** Planned movement this entry was swapped in for, that day only. */
    swappedFrom?: string | null;
  }[];
  /**
   * The day this was actually done, when it is not `dateISO`.
   *
   * Only the overdue path sets it: `dateISO` stays the day the workout counts
   * for, because adherence is keyed on it, and this records when it really
   * happened so the attendance grid and history can say so. Omitted for an
   * ordinary log and for a deliberately back-dated one — in both of those
   * `dateISO` already IS the day it was done.
   */
  completedOnISO?: string | null;
}): Promise<void> {
  await requireInteractive();
  await requireCanActFor(input.userId);
  if (!input.userId || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) return;

  // Delegates rather than reimplementing. This used to be its own copy of the
  // same logic, and the copy fell behind in three separate ways: it dropped the
  // reps on a WEIGHT entry, dropped `swappedFrom`, and created a NEW session on
  // every save, so "Edit weight" appended a duplicate instead of editing.
  //
  // The entry shapes already matched exactly, which is the tell that these were
  // one function wearing two hats. Permissions and revalidation stay here,
  // because those are the web's concern; what a logged workout IS belongs in
  // one place.
  await logPlannedWorkout(
    input.userId,
    input.dateISO,
    input.plannedWorkoutId,
    input.entries,
    { completedOnISO: input.completedOnISO ?? null },
  );
  refresh();
}

export async function addHiitWorkout(input: {
  name: string;
  type: WorkoutType;
  capSec?: number | null;
  pyramidStart?: number | null;
  pyramidEnd?: number | null;
  pyramidStep?: number | null;
  heroWod?: boolean;
  notes?: string | null;
  movements: {
    poolExerciseId: string;
    reps?: number | null;
    distance?: number | null;
    weight?: number | null;
  }[];
}): Promise<{ error: string | null }> {
  await requireAdmin();
  const name = input.name.trim().slice(0, 60);
  if (name.length < 2) return { error: "Give the workout a name." };
  const movements = input.movements.filter((m) => m.poolExerciseId);
  if (movements.length === 0) return { error: "Add at least one movement." };

  const count = await prisma.hiitWorkout.count({ where: { ownerId: null } });
  await prisma.hiitWorkout.create({
    data: {
      name,
      type: input.type,
      ownerId: null,
      approved: true,
      capSec: input.capSec ?? null,
      pyramidStart: input.pyramidStart ?? null,
      pyramidEnd: input.pyramidEnd ?? null,
      pyramidStep: input.pyramidStep ?? null,
      heroWod: input.heroWod ?? false,
      notes: input.notes?.trim() || null,
      sortOrder: count,
      movements: {
        create: movements.map((m, i) => ({
          poolExerciseId: m.poolExerciseId,
          reps: m.reps ?? null,
          distance: m.distance ?? null,
          weight: m.weight ?? null,
          position: i,
        })),
      },
    },
  });
  refresh();
  return { error: null };
}

/** Full edit of a named (HIIT/CrossFit) workout, movements included. */
export async function updateHiitWorkout(
  id: string,
  input: {
    name: string;
    type: WorkoutType;
    capSec?: number | null;
    pyramidStart?: number | null;
    pyramidEnd?: number | null;
    pyramidStep?: number | null;
    heroWod?: boolean;
    notes?: string | null;
    movements: {
      poolExerciseId: string;
      reps?: number | null;
      distance?: number | null;
      weight?: number | null;
    }[];
  },
): Promise<{ error: string | null }> {
  await requireAdmin();
  const name = input.name.trim().slice(0, 60);
  if (name.length < 2) return { error: "Give the workout a name." };
  const movements = input.movements.filter((m) => m.poolExerciseId);
  if (movements.length === 0) return { error: "Add at least one movement." };

  await prisma.hiitWorkout.update({
    where: { id },
    data: {
      name,
      type: input.type,
      capSec: input.capSec ?? null,
      pyramidStart: input.pyramidStart ?? null,
      pyramidEnd: input.pyramidEnd ?? null,
      pyramidStep: input.pyramidStep ?? null,
      ...(input.heroWod !== undefined ? { heroWod: input.heroWod } : {}),
      notes: input.notes?.trim() || null,
      // Replace the movement list wholesale — simplest correct edit.
      movements: {
        deleteMany: {},
        create: movements.map((m, i) => ({
          poolExerciseId: m.poolExerciseId,
          reps: m.reps ?? null,
          distance: m.distance ?? null,
          weight: m.weight ?? null,
          position: i,
        })),
      },
    },
  });
  refresh();
  return { error: null };
}

/** Flag or unflag a named workout as a Hero WOD. */
export async function setHeroWod(id: string, heroWod: boolean): Promise<void> {
  await requireAdmin();
  await prisma.hiitWorkout
    .update({ where: { id }, data: { heroWod } })
    .catch(() => {});
  refresh();
}

export async function deleteHiitWorkout(id: string): Promise<void> {
  await requireAdmin();
  await prisma.hiitWorkout.delete({ where: { id } }).catch(() => {});
  refresh();
}

/** A person asks that their own workout be shared (goes to admin to approve). */
export async function requestShareHiitWorkout(id: string): Promise<void> {
  await requireInteractive();
  if (!id) return;
  await prisma.hiitWorkout
    .updateMany({
      where: { id, ownerId: { not: null }, approved: false },
      data: { shareRequested: true },
    })
    .catch(() => {});
  refresh();
}

/** Admin approves a share: the workout joins the shared pool for everyone. */
export async function approveHiitWorkout(id: string): Promise<void> {
  await requireAdmin();
  await prisma.hiitWorkout
    .update({
      where: { id },
      data: { ownerId: null, approved: true, shareRequested: false },
    })
    .catch(() => {});
  refresh();
}

/** Admin dismisses a share request; the workout stays personal. */
export async function dismissHiitShare(id: string): Promise<void> {
  await requireAdmin();
  await prisma.hiitWorkout
    .updateMany({ where: { id }, data: { shareRequested: false } })
    .catch(() => {});
  refresh();
}

/** Admin renames a workout. */
export async function renameHiitWorkout(
  id: string,
  name: string,
): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return;
  await prisma.hiitWorkout
    .update({ where: { id }, data: { name: clean } })
    .catch(() => {});
  refresh();
}

// --- one-off custom workout ---------------------------------------------

/**
 * Log a custom, one-off workout straight from the card: name it, say what kind
 * it is and what to record, and drop today's result in. Reuses an existing
 * definition of the same name and category if there is one (so logging "Murph"
 * each week doesn't pile up duplicates), otherwise creates it — kept off the
 * progress graph unless `tracked`. The result is written as a single-set
 * session for the day, completing "worked out today" like any other log.
 */
export type CustomLogResult =
  | { ok: true }
  | { conflict: { name: string; summary: string } };

export async function logCustomWorkout(input: {
  userId: string;
  dateISO: string;
  poolExerciseId?: string | null; // a movement from the shared pool
  category?: WorkoutCategory | null; // used for metric-only logs (a run, a row)
  metric: Metric;
  value: number;
  unit: string;
  load?: number | null;
  /** Reps for a WEIGHT log; the weight is still the record. */
  reps?: number | null;
  notes?: string;
  replace?: boolean; // overwrite the same movement already logged that day
}): Promise<CustomLogResult> {
  await requireInteractive();
  await requireCanActFor(input.userId);
  if (!input.userId) return { ok: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) return { ok: true };

  // Delegates, like completePlannedWorkout. This was its own copy of the phone's
  // logCustomEntry, which is how adding reps would have meant changing two.
  // Same movement already logged that day comes back as a conflict so the form
  // can ask "update or cancel"; on replace that session is edited in place.
  const result = await logCustomEntry(input.userId, input.dateISO, {
    poolExerciseId: input.poolExerciseId ?? null,
    category: input.category ?? null,
    metric: input.metric,
    value: input.value,
    unit: input.unit,
    load: input.load ?? null,
    reps: input.reps ?? null,
    notes: input.notes,
    replace: input.replace,
    detectConflict: true,
  });
  if (result?.conflict) return { conflict: result.conflict };
  refresh();
  return { ok: true };
}

/** Shared writer: one HIIT session (name + type + result), movements in notes. */
async function writeHiitSession(input: {
  userId: string;
  dateISO: string;
  name: string;
  type: WorkoutType;
  movementNames: string[];
  value: number;
  notes?: string;
}): Promise<void> {
  const { metric } = hiitResult(input.type);
  const notes =
    [input.movementNames.join(", "), input.notes?.trim() || ""]
      .filter(Boolean)
      .join(" \u2014 ")
      .slice(0, 300) || null;

  const date = toDateColumn(input.dateISO);
  const session = await prisma.workoutSession.create({
    data: {
      userId: input.userId,
      date,
      name: input.name.slice(0, 60),
      category: "HIIT",
      workoutType: input.type,
      finished: true,
      isRest: false,
      notes,
    },
  });

  const set: {
    sessionId: string;
    poolExerciseId: string | null;
    setNumber: number;
    unit: string | null;
    finished: boolean;
    reps?: number;
    seconds?: number;
  } = {
    sessionId: session.id,
    poolExerciseId: null,
    setNumber: 1,
    unit: null,
    finished: true,
  };
  if (metric === "DURATION") set.seconds = Math.round(input.value);
  else set.reps = Math.round(input.value);

  await prisma.sessionSet.create({ data: set });
  // Settled rather than completed: a planned HIIT workout on a day that also
  // has lifts planned is one part of the day, not all of it.
  await settleWorkoutTask(input.userId, input.dateISO, { fallbackComplete: true });
  refresh();
}

/** Log a result against an existing named HIIT/CrossFit workout. */
export async function logHiitWorkout(input: {
  userId: string;
  dateISO: string;
  hiitWorkoutId: string;
  value: number;
  notes?: string;
}): Promise<void> {
  await requireInteractive();
  await requireCanActFor(input.userId);
  if (!input.userId || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) return;
  if (!Number.isFinite(input.value) || input.value <= 0) return;

  const w = (await prisma.hiitWorkout.findUnique({
    where: { id: input.hiitWorkoutId },
    select: {
      name: true,
      type: true,
      movements: {
        orderBy: { position: "asc" },
        select: {
          reps: true,
          distance: true,
          weight: true,
          poolExercise: { select: { name: true } },
        },
      },
    },
  })) as unknown as {
    name: string;
    type: WorkoutType;
    movements: {
      reps: number | null;
      distance: number | null;
      weight: number | null;
      poolExercise: { name: string } | null;
    }[];
  } | null;
  if (!w) return;

  const movementNames = w.movements
    .filter((m) => m.poolExercise)
    .map((m) =>
      formatHiitMovement({
        name: m.poolExercise!.name,
        reps: m.reps,
        distance: m.distance,
        weight: m.weight,
      }),
    );

  await writeHiitSession({
    userId: input.userId,
    dateISO: input.dateISO,
    name: w.name,
    type: w.type,
    movementNames,
    value: input.value,
    notes: input.notes,
  });
}

/**
 * Create a new HIIT/CrossFit workout in the person's own pool (unapproved
 * until shared) and log a result for it in one step.
 */
export async function createAndLogHiitWorkout(input: {
  userId: string;
  dateISO: string;
  name: string;
  type: WorkoutType;
  capSec?: number | null;
  pyramidStart?: number | null;
  pyramidEnd?: number | null;
  pyramidStep?: number | null;
  movements: { poolExerciseId: string; reps?: number | null }[];
  value: number;
  notes?: string;
}): Promise<{ error: string | null }> {
  await requireInteractive();
  await requireCanActFor(input.userId);
  if (!input.userId || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) {
    return { error: "Something went wrong." };
  }
  const name = input.name.trim().slice(0, 60);
  if (name.length < 2) return { error: "Name the workout." };
  const movements = input.movements.filter((m) => m.poolExerciseId);
  if (movements.length === 0) return { error: "Add at least one movement." };
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return { error: "Enter a result." };
  }

  const count = await prisma.hiitWorkout.count({
    where: { ownerId: input.userId },
  });
  const created = await prisma.hiitWorkout.create({
    data: {
      name,
      type: input.type,
      ownerId: input.userId,
      approved: false,
      capSec: input.capSec ?? null,
      pyramidStart: input.pyramidStart ?? null,
      pyramidEnd: input.pyramidEnd ?? null,
      pyramidStep: input.pyramidStep ?? null,
      sortOrder: count,
      movements: {
        create: movements.map((m, i) => ({
          poolExerciseId: m.poolExerciseId,
          reps: m.reps ?? null,
          position: i,
        })),
      },
    },
    select: { id: true },
  });

  await logHiitWorkout({
    userId: input.userId,
    dateISO: input.dateISO,
    hiitWorkoutId: created.id,
    value: input.value,
    notes: input.notes,
  });
  return { error: null };
}

/** Delete one logged workout. If it was the day's last, the day drops back to
 *  "not logged yet". Rest days and other workouts on the day are untouched. */
export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  await requireInteractive();
  if (!sessionId) return;
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, date: true },
  });
  if (!session) return;
  await requireCanActFor(session.userId);

  await prisma.workoutSession.delete({ where: { id: sessionId } });

  const remaining = await prisma.workoutSession.count({
    where: { userId: session.userId, date: session.date, isRest: false },
  });
  if (remaining === 0) {
    // Only a task that a logged session completed drops back to "not logged
    // yet". A SKIPPED rest day, or a day with no plan, is left untouched — so
    // deleting a rest day can't resurrect it as an overdue workout.
    const task = await prisma.task.findFirst({
      where: {
        userId: session.userId,
        category: "EXERCISE",
        dueDate: session.date,
        status: "COMPLETE",
      },
    });
    if (task) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "PENDING", completedAt: null },
      });
    }
  }
  refresh();
}

/** Weights already logged for a person on a date, keyed by pool-exercise id, so
 *  Log workout can pre-fill them when back-dating an earlier day (like the app). */
export async function loadLoggedWeights(
  userId: string,
  dateISO: string,
): Promise<Record<string, LoggedSet>> {
  await requireInteractive();
  await requireCanActFor(userId);
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, date: toDateColumn(dateISO) },
    // Reps as well as weight. Without them the plan could prefill what you
    // lifted but not how many times, so reopening a logged day showed a
    // half-filled row and a button offering to log it again.
    select: {
      sets: { select: { poolExerciseId: true, weight: true, reps: true } },
    },
  });
  const out: Record<string, LoggedSet> = {};
  // A movement logged set by set has several sets: prefill its top one.
  const byPool = new Map<string, { weight: number | null; reps: number | null }[]>();
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.poolExerciseId != null && set.weight != null) {
        const list = byPool.get(set.poolExerciseId) ?? [];
        list.push(set);
        byPool.set(set.poolExerciseId, list);
      }
    }
  }
  for (const [id, list] of byPool) {
    const top = topSet(list);
    if (top && top.weight != null) {
      out[id] = { weight: String(top.weight), reps: top.reps != null ? String(top.reps) : "" };
    }
  }
  // Skipped movements ride in the same map, so the card can show them as
  // skipped without a second fetch. A plan's own slot ("plan:<id>") is keyed
  // as-is.
  const skips = (await prisma.workoutMovementSkip.findMany({
    where: { userId, date: toDateColumn(dateISO) },
    select: { slot: true },
  })) as { slot: string }[];
  for (const { slot } of skips) {
    out[slot] = { ...(out[slot] ?? { weight: "", reps: "" }), skipped: true };
  }
  return out;
}

/** A set already logged for a date, for prefilling the plan's fields.
 *  `skipped` marks a movement skipped for that day (it may have no set). */
export type LoggedSet = { weight: string; reps: string; skipped?: boolean };

/** Overdue workout dates for a person (today's overdue window), for the web's
 *  Overdue section. */
export async function overdueWorkoutDates(userId: string): Promise<string[]> {
  await requireInteractive();
  await requireCanActFor(userId);
  return loadOverdueWorkoutDates(userId, todayISO());
}


// --- the day page (every set) ------------------------------------------------

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The day page's state for a person and date, plus the prefill map the
 *  whole-workout cards (warm-up, cardio, HIIT) still use. */
export async function loadDayLog(
  userId: string,
  dateISO: string,
): Promise<{ state: DayLogState; loggedByPool: Record<string, LoggedSet> }> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!ISO.test(dateISO)) throw new Error("Bad date");
  const [state, loggedByPool] = await Promise.all([
    loadDayLogState(userId, dateISO),
    loadLoggedWeights(userId, dateISO),
  ]);
  return { state, loggedByPool };
}

/** One movement's sets for the day, and its last time, for the set logger. */
export async function loadMovementSets(
  userId: string,
  dateISO: string,
  slotId: string,
  doing?: string | null,
): Promise<MovementLog> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!ISO.test(dateISO) || !slotId) throw new Error("Bad request");
  return loadMovementLog(userId, dateISO, slotId, doing ?? null);
}

/**
 * Save a planned movement's sets for a day (every saved set, in order; empty
 * clears it). Called on each tick, each removal, and on Log. Only `final`
 * (Log, leaving the movement) refreshes the pages, so ticking sets doesn't
 * re-render the whole Exercise page between sets.
 */
export async function saveMovementSets(input: {
  userId: string;
  dateISO: string;
  plannedWorkoutId: string;
  slotId: string;
  loggedId: string;
  metric: Metric;
  unit: string;
  sets: MovementSetIn[];
  completedOnISO?: string | null;
  final?: boolean;
}): Promise<{ ok: boolean }> {
  await requireInteractive();
  await requireCanActFor(input.userId);
  if (!ISO.test(input.dateISO) || !input.plannedWorkoutId || !input.slotId) return { ok: false };
  if (!Array.isArray(input.sets) || input.sets.length > 50) return { ok: false };
  const r = await logMovementSets(
    input.userId,
    input.dateISO,
    input.plannedWorkoutId,
    input.slotId,
    { loggedId: input.loggedId, metric: input.metric, unit: input.unit, sets: input.sets },
    { completedOnISO: input.completedOnISO ?? null },
  );
  if (input.final) refresh();
  return { ok: r === "ok" };
}

/** The week strip: the last 8 days with each day's workout state, and which
 *  past days are still open for logging. */
export async function loadWorkoutWeek(
  userId: string,
): Promise<{ days: WeekStripDay[]; overdue: string[]; today: string }> {
  await requireInteractive();
  await requireCanActFor(userId);
  const today = todayISO();
  const r = await loadWeekStrip(userId, today);
  return { ...r, today };
}
