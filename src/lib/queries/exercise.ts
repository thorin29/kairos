import "server-only";
import { prisma } from "@/lib/prisma";
import { dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";

export type LoggedSet = {
  sets: number | null;
  reps: number | null;
  weight: number | null;
};

export type WorkoutExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight: string | null;
  today: LoggedSet | null;
  last: (LoggedSet & { day: string }) | null;
};

export type WorkoutCard = {
  assignmentId: string;
  taskId: string | null;
  done: boolean;
  user: { id: string; name: string; color: string; avatarPath: string | null };
  routineName: string;
  exercises: WorkoutExercise[];
};

/** Everyone's workout for a given day: the routine, its movements, what's been
 *  logged today, and the last time each movement was done. */
export async function loadWorkoutDay(iso: string): Promise<WorkoutCard[]> {
  const dow = dayOfWeek(iso);

  const assignments = await prisma.routineAssignment.findMany({
    where: { isActive: true, dayOfWeek: dow, routine: { isActive: true } },
    include: {
      user: { select: { id: true, name: true, displayName: true, color: true, avatarPath: true } },
      routine: {
        select: {
          name: true,
          exercises: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (assignments.length === 0) return [];

  const assignmentIds = assignments.map((a) => a.id);
  const exerciseIds = assignments.flatMap((a) => a.routine.exercises.map((e) => e.id));

  const [tasks, todayLogs, priorLogs] = await Promise.all([
    prisma.task.findMany({
      where: {
        category: "EXERCISE",
        dueDate: toDateColumn(iso),
        generatedFrom: { in: assignmentIds },
      },
      select: { id: true, status: true, generatedFrom: true },
    }),
    prisma.exerciseLog.findMany({
      where: { day: toDateColumn(iso), exerciseId: { in: exerciseIds } },
      select: { userId: true, exerciseId: true, sets: true, reps: true, weight: true },
    }),
    prisma.exerciseLog.findMany({
      where: { day: { lt: toDateColumn(iso) }, exerciseId: { in: exerciseIds } },
      orderBy: { day: "desc" },
      take: 800,
      select: { userId: true, exerciseId: true, day: true, sets: true, reps: true, weight: true },
    }),
  ]);

  type TaskLite = { id: string; status: string; generatedFrom: string | null };
  type LogLite = {
    userId: string;
    exerciseId: string;
    sets: number | null;
    reps: number | null;
    weight: number | null;
  };

  const taskByAssignment = new Map<string, TaskLite>(
    (tasks as TaskLite[]).map((t) => [t.generatedFrom ?? "", t]),
  );
  const todayByKey = new Map<string, LogLite>(
    (todayLogs as LogLite[]).map((l) => [`${l.userId}|${l.exerciseId}`, l]),
  );
  const lastByKey = new Map<string, LogLite & { day: Date }>();
  for (const l of priorLogs as (LogLite & { day: Date })[]) {
    const k = `${l.userId}|${l.exerciseId}`;
    if (!lastByKey.has(k)) lastByKey.set(k, l); // first is most recent (desc)
  }

  return assignments.map((a) => {
    const task = taskByAssignment.get(a.id);
    return {
      assignmentId: a.id,
      taskId: task?.id ?? null,
      done: task?.status === "COMPLETE",
      user: {
        id: a.user.id,
        name: a.user.displayName ?? a.user.name,
        color: a.user.color,
        avatarPath: a.user.avatarPath,
      },
      routineName: a.routine.name,
      exercises: a.routine.exercises.map((e) => {
        const today = todayByKey.get(`${a.userId}|${e.id}`);
        const last = lastByKey.get(`${a.userId}|${e.id}`);
        return {
          id: e.id,
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight,
          today: today
            ? { sets: today.sets, reps: today.reps, weight: today.weight }
            : null,
          last: last
            ? {
                sets: last.sets,
                reps: last.reps,
                weight: last.weight,
                day: fromDateColumn(last.day),
              }
            : null,
        };
      }),
    };
  });
}

export type AdminRoutine = {
  id: string;
  name: string;
  notes: string | null;
  isActive: boolean;
  exercises: {
    id: string;
    name: string;
    sets: number;
    reps: string;
    weight: string | null;
  }[];
};

export async function loadExerciseAdmin(): Promise<{
  routines: AdminRoutine[];
  roster: { id: string; name: string; color: string; avatarPath: string | null }[];
  assignments: { routineId: string; userId: string; dayOfWeek: number }[];
}> {
  const [routines, roster, assignments] = await Promise.all([
    prisma.exerciseRoutine.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { exercises: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true, color: true, avatarPath: true },
    }),
    prisma.routineAssignment.findMany({
      where: { isActive: true },
      select: { routineId: true, userId: true, dayOfWeek: true },
    }),
  ]);

  return {
    routines: routines.map((r) => ({
      id: r.id,
      name: r.name,
      notes: r.notes,
      isActive: r.isActive,
      exercises: r.exercises.map((e) => ({
        id: e.id,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
      })),
    })),
    roster: roster.map((u) => ({
      id: u.id,
      name: u.displayName ?? u.name,
      color: u.color,
      avatarPath: u.avatarPath,
    })),
    assignments,
  };
}
