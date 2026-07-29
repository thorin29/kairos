"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { setSetting } from "@/lib/settings";
import { toDateColumn, todayISO } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import {
  UNIT_SYSTEM_KEY,
  type Implement,
  type Metric,
  type UnitSystem,
  type WorkoutCategory,
} from "@/lib/workouts/catalog";

function refresh() {
  revalidatePath("/exercise");
  revalidatePath("/admin/exercise");
  revalidatePath("/");
}

// --- admin ---------------------------------------------------------------

export async function setUnitSystem(system: UnitSystem): Promise<void> {
  await requireAdmin();
  await setSetting(UNIT_SYSTEM_KEY, system === "metric" ? "metric" : "imperial");
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
  await prisma.exercise.update({ where: { id }, data: { isActive: false } });
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
  await prisma.plannedWorkout.delete({ where: { id } }).catch(() => {});
  await generateWorkoutTasks();
  refresh();
}

/** Copy a day's named workouts onto another day, skipping ones already there. */
export async function copyDayPlan(
  userId: string,
  fromDay: number,
  toDay: number,
): Promise<void> {
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
export async function restDay(userId: string, dateISO: string): Promise<void> {
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
  name: string;
  category: WorkoutCategory;
  metric: Metric;
  value: number;
  unit: string;
  load?: number | null;
  tracked?: boolean;
  notes?: string;
}): Promise<void> {
  const name = input.name.trim().slice(0, 60);
  if (!input.userId || name.length < 1) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) return;
  if (!Number.isFinite(input.value) || input.value <= 0) return;

  const unit = input.unit.trim().slice(0, 8);
  const date = toDateColumn(input.dateISO);

  const existing = await prisma.exercise.findFirst({
    where: {
      userId: input.userId,
      category: input.category,
      isActive: true,
      name: { equals: name, mode: "insensitive" },
    },
  });

  let exerciseId: string;
  if (existing) {
    exerciseId = existing.id;
  } else {
    const count = await prisma.exercise.count({ where: { userId: input.userId } });
    const created = await prisma.exercise.create({
      data: {
        userId: input.userId,
        name,
        category: input.category,
        implement: input.category === "WEIGHTS" ? "NONE" : null,
        unit: unit || "rep",
        metric: input.metric,
        tracked: input.tracked ?? false,
        sortOrder: count,
      },
    });
    exerciseId = created.id;
  }

  // Each custom log is its own named session, so a day can hold several — a
  // lift and a run, hockey and a ride, or the same thing done twice.
  const session = await prisma.workoutSession.create({
    data: {
      userId: input.userId,
      date,
      name,
      category: input.category,
      finished: true,
      isRest: false,
      notes: input.notes?.slice(0, 300) || null,
    },
  });

  const set: {
    sessionId: string;
    exerciseId: string;
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
    exerciseId,
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

/** Delete one logged workout. If it was the day's last, the day drops back to
 *  "not logged yet". Rest days and other workouts on the day are untouched. */
export async function deleteWorkoutSession(sessionId: string): Promise<void> {
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
