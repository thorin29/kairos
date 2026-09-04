import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { CATEGORY_LABEL, type WorkoutCategory } from "@/lib/workouts/catalog";

/**
 * The guard-free core of workout completion, shared by the web server action
 * (src/lib/actions/workouts.ts) and the mobile API (/api/v1/workouts/*), so the
 * "did you work out / rest today" rules live in exactly one place. Callers add
 * their own authorization: the web action checks the session gate, the API
 * checks the device token's person. Both re-validate the shared views here so a
 * phone action still refreshes the wall tablet.
 */

/** Mark the day's workout task done, creating one if the day had a prompt.
 *  Mirrors the web's completeWorkoutTask. */
export async function completeWorkoutTask(
  userId: string,
  dateISO: string,
): Promise<void> {
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
  revalidatePath(`/person/${userId}`);
}

/** A rest day excuses the day's workout task (SKIPPED — scores nothing, doesn't
 *  count against completion). If nothing was planned, nothing is excused: a rest
 *  day must never manufacture a prompt that could later look overdue. */
export async function skipWorkoutTask(
  userId: string,
  dateISO: string,
): Promise<void> {
  const due = toDateColumn(dateISO);
  const existing = await prisma.task.findFirst({
    where: { userId, category: "EXERCISE", dueDate: due },
  });
  if (existing) {
    await prisma.task.update({
      where: { id: existing.id },
      data: { status: "SKIPPED", completedAt: null },
    });
  }
  revalidatePath(`/person/${userId}`);
}

export async function findOrCreateSession(
  userId: string,
  dateISO: string,
): Promise<string> {
  const date = toDateColumn(dateISO);
  const found = await prisma.workoutSession.findFirst({
    where: { userId, date },
  });
  if (found) return found.id;
  const created = await prisma.workoutSession.create({
    data: { userId, date },
  });
  return created.id;
}

/**
 * "I worked out today" without set-by-set detail: create a placeholder session
 * and complete the day's workout task. `worked = false` undoes a placeholder —
 * it removes only empty sessions (never a real logged one) and reopens the task
 * if nothing real remains. Mirrors the web's markWorkedOut.
 */
export async function setWorkedOut(
  userId: string,
  dateISO: string,
  worked: boolean,
): Promise<void> {
  const date = toDateColumn(dateISO);
  if (worked) {
    await findOrCreateSession(userId, dateISO);
    await completeWorkoutTask(userId, dateISO);
    return;
  }
  await prisma.workoutSession.deleteMany({
    where: { userId, date, isRest: false, sets: { none: {} } },
  });
  const remaining = await prisma.workoutSession.count({
    where: { userId, date, isRest: false },
  });
  if (remaining === 0) {
    const task = await prisma.task.findFirst({
      where: {
        userId,
        category: "EXERCISE",
        dueDate: date,
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
}

/** Mark the day a rest day. Mirrors the web's restDay. */
export async function setRestDay(
  userId: string,
  dateISO: string,
): Promise<void> {
  const date = toDateColumn(dateISO);
  const existing = await prisma.workoutSession.findFirst({
    where: { userId, date },
  });
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
  await skipWorkoutTask(userId, dateISO);
}

export type WorkoutLogEntry = {
  exerciseId: string;
  weight?: number | null;
  reps?: number | null;
  distance?: number | null;
  meters?: number | null;
  seconds?: number | null;
  unit?: string | null;
  finished?: boolean;
};

/**
 * The guard-free core of logSession, shared by the web action and the mobile
 * API. Records one summary set (setNumber 1) per exercise on the day's session
 * and completes the workout task. An entry with no values clears that exercise's
 * set. Mirrors the web's logSession exactly.
 */
export async function logWorkoutSession(
  userId: string,
  dateISO: string,
  entries: WorkoutLogEntry[],
  opts?: { finished?: boolean; notes?: string },
): Promise<void> {
  const sessionId = await findOrCreateSession(userId, dateISO);

  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: {
      finished: opts?.finished ?? true,
      isRest: false,
      ...(opts?.notes !== undefined ? { notes: opts.notes.slice(0, 300) } : {}),
    },
  });

  for (const e of entries) {
    if (!e.exerciseId) continue;
    const hasValue =
      e.weight != null ||
      e.reps != null ||
      e.distance != null ||
      e.meters != null ||
      e.seconds != null;

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

  await completeWorkoutTask(userId, dateISO);
}

export type PlannedLogEntry = {
  poolExerciseId: string;
  metric: string;
  value: number;
  unit: string;
};

/**
 * Log a planned workout (a named plan of shared pool movements, e.g. "Legs"):
 * one value per movement, typed by its metric. Edit-friendly — reuses the day's
 * session and replaces its sets — then completes the workout task. Mirrors the
 * web's completePlannedWorkout, adapted to a single editable session per day.
 */
export async function logPlannedWorkout(
  userId: string,
  dateISO: string,
  plannedWorkoutId: string,
  entries: PlannedLogEntry[],
): Promise<void> {
  const plan = await prisma.plannedWorkout.findUnique({
    where: { id: plannedWorkoutId },
    select: { name: true, category: true, userId: true },
  });
  if (!plan || plan.userId !== userId) return;

  const sessionId = await findOrCreateSession(userId, dateISO);
  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: {
      name: plan.name,
      category: plan.category,
      finished: true,
      isRest: false,
    },
  });
  await prisma.sessionSet.deleteMany({ where: { sessionId } });

  let setNumber = 0;
  for (const e of entries) {
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
      sessionId,
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

  await completeWorkoutTask(userId, dateISO);
}

/** Delete one of the caller's own workout sessions (for the Recent page's
 *  "remove a mistake"). Cascade removes its sets. */
export async function deleteWorkoutSessionOwned(
  sessionId: string,
  userId: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  const s = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!s) return "not_found";
  if (s.userId !== userId) return "forbidden";
  await prisma.workoutSession.delete({ where: { id: sessionId } });
  return "ok";
}

export type CustomLogInput = {
  poolExerciseId?: string | null;
  category?: string | null; // WorkoutCategory, for metric-only logs (a run, a row)
  metric: string;
  value: number;
  unit: string;
  load?: number | null;
  notes?: string;
};

/**
 * Log an ad-hoc "different workout" — a pool movement or a metric-only activity.
 * Each is its own named session (a day can hold several). Mirrors the web's
 * logCustomWorkout; completes the workout task.
 */
export async function logCustomEntry(
  userId: string,
  dateISO: string,
  input: CustomLogInput,
): Promise<void> {
  if (!Number.isFinite(input.value) || input.value <= 0) return;

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
    category = input.category as WorkoutCategory;
    name = CATEGORY_LABEL[category];
  } else {
    return;
  }

  const unit = input.unit.trim().slice(0, 8);
  const date = toDateColumn(dateISO);
  const session = await prisma.workoutSession.create({
    data: {
      userId,
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
  if (input.load != null && input.load > 0 && set.weight == null) {
    set.weight = input.load;
  }
  await prisma.sessionSet.create({ data: set });

  await completeWorkoutTask(userId, dateISO);
}
