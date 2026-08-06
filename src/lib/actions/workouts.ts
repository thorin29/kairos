"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { setSetting, WORKOUT_OVERDUE_DAYS, WORKOUT_OVERDUE_MAX } from "@/lib/settings";
import { toDateColumn, todayISO } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import {
  CATEGORY_LABEL,
  MUSCLE_GROUP_LABEL,
  WORKOUT_TYPE_LABEL,
  formatHiitMovement,
  hiitResult,
  weightUnitKey,
  type Implement,
  type Metric,
  type MuscleGroup,
  type WeightUnit,
  type WorkoutCategory,
  type WorkoutType,
} from "@/lib/workouts/catalog";

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
  await prisma.poolExercise
    .create({
      data: { category: input.category, name, muscleGroup, sortOrder: count },
    })
    .catch(() => {});
  refresh();
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

async function completeWorkoutTask(userId: string, dateISO: string): Promise<void> {
  const due = toDateColumn(dateISO);
  const existing = await prisma.task.findFirst({
    where: { userId, category: "EXERCISE", dueDate: due },
  });
  if (existing) {
    await prisma.task.update({
      where: { id: existing.id },
      data: { status: "COMPLETE", completedAt: new Date() },
    });
  } else {
    await prisma.task.create({
      data: {
        userId,
        category: "EXERCISE",
        title: "Workout",
        dueDate: due,
        status: "COMPLETE",
        completedAt: new Date(),
        generatedFrom: `workout:${userId}`,
      },
    });
  }
  // A workout can be logged from a person's dashboard now, so refresh it.
  revalidatePath(`/person/${userId}`);
}

async function findOrCreateSession(userId: string, dateISO: string): Promise<string> {
  const date = toDateColumn(dateISO);
  const found = await prisma.workoutSession.findFirst({ where: { userId, date } });
  if (found) return found.id;
  const created = await prisma.workoutSession.create({ data: { userId, date } });
  return created.id;
}

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
  if (!input.userId || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) return;

  const sessionId = await findOrCreateSession(input.userId, input.dateISO);

  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: {
      finished: input.finished ?? true,
      isRest: false,
      ...(input.notes !== undefined ? { notes: input.notes.slice(0, 300) } : {}),
    },
  });

  for (const e of input.entries) {
    const hasValue =
      e.weight != null ||
      e.reps != null ||
      e.distance != null ||
      e.meters != null ||
      e.seconds != null;
    if (!e.exerciseId) continue;

    if (!hasValue) {
      await prisma.sessionSet.deleteMany({
        where: { sessionId, exerciseId: e.exerciseId, setNumber: 1 },
      });
      continue;
    }

    await prisma.sessionSet.upsert({
      where: {
        sessionId_exerciseId_setNumber: {
          sessionId,
          exerciseId: e.exerciseId,
          setNumber: 1,
        },
      },
      update: {
        weight: e.weight ?? null,
        reps: e.reps ?? null,
        distance: e.distance ?? null,
        meters: e.meters ?? null,
        seconds: e.seconds ?? null,
        unit: e.unit ?? null,
        finished: e.finished ?? true,
      },
      create: {
        sessionId,
        exerciseId: e.exerciseId,
        setNumber: 1,
        weight: e.weight ?? null,
        reps: e.reps ?? null,
        distance: e.distance ?? null,
        meters: e.meters ?? null,
        seconds: e.seconds ?? null,
        unit: e.unit ?? null,
        finished: e.finished ?? true,
      },
    });
  }

  await completeWorkoutTask(input.userId, input.dateISO);
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
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;
  const date = toDateColumn(dateISO);

  if (worked) {
    await findOrCreateSession(userId, dateISO);
    await completeWorkoutTask(userId, dateISO);
  } else {
    // Remove only empty placeholder sessions (a quick "worked out" with no
    // detail); never delete a logged workout. Reset the day only if nothing
    // real is left.
    await prisma.workoutSession.deleteMany({
      where: { userId, date, isRest: false, sets: { none: {} } },
    });
    const remaining = await prisma.workoutSession.count({
      where: { userId, date, isRest: false },
    });
    if (remaining === 0) {
      const task = await prisma.task.findFirst({
        where: { userId, category: "EXERCISE", dueDate: date },
      });
      if (task) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: "PENDING", completedAt: null },
        });
      }
    }
  }
  refresh();
}

// --- workout plan (named workouts per weekday) ---------------------------

export async function addPlannedWorkout(
  userId: string,
  dayOfWeek: number,
  name: string,
): Promise<void> {
  await requireInteractive();
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
          metric: e.metric ?? null,
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
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;
  const date = toDateColumn(dateISO);

  const existing = await prisma.workoutSession.findFirst({ where: { userId, date } });
  if (existing) {
    await prisma.workoutSession.update({
      where: { id: existing.id },
      data: { isRest: true, finished: false },
    });
  } else {
    await prisma.workoutSession.create({
      data: { userId, date, isRest: true, finished: false },
    });
  }
  await completeWorkoutTask(userId, dateISO);
  refresh();
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
  }[];
}): Promise<void> {
  await requireInteractive();
  if (!input.userId || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) return;

  const plan = (await prisma.plannedWorkout.findUnique({
    where: { id: input.plannedWorkoutId },
    select: { name: true, category: true, userId: true },
  })) as unknown as {
    name: string;
    category: WorkoutCategory | null;
    userId: string;
  } | null;
  if (!plan || plan.userId !== input.userId) return;

  const date = toDateColumn(input.dateISO);
  const session = await prisma.workoutSession.create({
    data: {
      userId: input.userId,
      date,
      name: plan.name,
      category: plan.category,
      finished: true,
      isRest: false,
    },
  });

  let setNumber = 0;
  for (const e of input.entries) {
    if (!Number.isFinite(e.value) || e.value <= 0) continue;
    setNumber++;
    const set: {
      sessionId: string;
      poolExerciseId: string | null;
      setNumber: number;
      unit: string | null;
      finished: boolean;
      weight?: number;
      reps?: number;
      distance?: number;
      meters?: number;
      seconds?: number;
    } = {
      sessionId: session.id,
      poolExerciseId: e.poolExerciseId,
      setNumber,
      unit: e.unit || null,
      finished: true,
    };
    switch (e.metric) {
      case "WEIGHT":
        set.weight = e.value;
        break;
      case "REPS":
        set.reps = Math.round(e.value);
        break;
      case "DISTANCE":
        set.distance = e.value;
        break;
      case "METERS":
        set.meters = e.value;
        break;
      case "DURATION":
        set.seconds = Math.round(e.value);
        break;
    }
    await prisma.sessionSet.create({ data: set });
  }

  await completeWorkoutTask(input.userId, input.dateISO);
  refresh();
}

export async function addHiitWorkout(input: {
  name: string;
  type: WorkoutType;
  capSec?: number | null;
  pyramidStart?: number | null;
  pyramidEnd?: number | null;
  pyramidStep?: number | null;
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
export async function logCustomWorkout(input: {
  userId: string;
  dateISO: string;
  poolExerciseId?: string | null; // a movement from the shared pool
  category?: WorkoutCategory | null; // used for metric-only logs (a run, a row)
  metric: Metric;
  value: number;
  unit: string;
  load?: number | null;
  notes?: string;
}): Promise<void> {
  await requireInteractive();
  if (!input.userId) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) return;
  if (!Number.isFinite(input.value) || input.value <= 0) return;

  // Resolve what was done: a named pool movement, or a metric-only activity
  // that takes its identity from the category (running, rowing, rucking).
  let name: string;
  let category: WorkoutCategory;
  let poolExerciseId: string | null = null;
  if (input.poolExerciseId) {
    const pool = await prisma.poolExercise.findUnique({
      where: { id: input.poolExerciseId },
      select: { name: true, category: true },
    });
    if (!pool) return;
    name = pool.name;
    category = pool.category as WorkoutCategory;
    poolExerciseId = input.poolExerciseId;
  } else if (input.category) {
    category = input.category;
    name = CATEGORY_LABEL[input.category];
  } else {
    return;
  }

  const unit = input.unit.trim().slice(0, 8);
  const date = toDateColumn(input.dateISO);

  // Each log is its own named session, so a day can hold several — a lift and a
  // run, hockey and a ride, or the same thing done twice.
  const session = await prisma.workoutSession.create({
    data: {
      userId: input.userId,
      date,
      name,
      category,
      finished: true,
      isRest: false,
      notes: input.notes?.slice(0, 300) || null,
    },
  });

  const set: {
    sessionId: string;
    poolExerciseId: string | null;
    setNumber: number;
    unit: string | null;
    finished: boolean;
    weight?: number;
    reps?: number;
    distance?: number;
    meters?: number;
    seconds?: number;
  } = {
    sessionId: session.id,
    poolExerciseId,
    setNumber: 1,
    unit: unit || null,
    finished: true,
  };
  switch (input.metric) {
    case "WEIGHT":
      set.weight = input.value;
      break;
    case "REPS":
      set.reps = Math.round(input.value);
      break;
    case "DISTANCE":
      set.distance = input.value;
      break;
    case "METERS":
      set.meters = input.value;
      break;
    case "DURATION":
      set.seconds = Math.round(input.value);
      break;
  }
  // A carried load (e.g. a ruck) rides alongside the distance in the weight
  // column, so it shows in the summary without needing its own metric.
  if (input.load != null && input.load > 0 && set.weight == null) {
    set.weight = input.load;
  }

  await prisma.sessionSet.create({ data: set });
  await completeWorkoutTask(input.userId, input.dateISO);
  refresh();
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
  await completeWorkoutTask(input.userId, input.dateISO);
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

  await prisma.workoutSession.delete({ where: { id: sessionId } });

  const remaining = await prisma.workoutSession.count({
    where: { userId: session.userId, date: session.date, isRest: false },
  });
  if (remaining === 0) {
    const task = await prisma.task.findFirst({
      where: { userId: session.userId, category: "EXERCISE", dueDate: session.date },
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
