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
    const session = await prisma.workoutSession.findFirst({
      where: { userId, date },
      include: { _count: { select: { sets: true } } },
    });
    if (session && session._count.sets === 0) {
      await prisma.workoutSession.delete({ where: { id: session.id } });
    }
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
