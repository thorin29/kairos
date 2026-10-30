"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { loadWeightUnits } from "@/lib/queries/workouts";
import { fromDateColumn, todayISO } from "@/lib/dates";
import { APP_VERSION } from "@/lib/version";

/**
 * Everything the workouts area holds, as one JSON file, for planning better
 * programs from what people really do: who trains (role, child or parent, age
 * in years — never the birthday), the movement pool and older per-person
 * exercises, every plan, rotation and weekly schedule, the HIIT workouts, every
 * logged session with all its sets, skipped movements, and the workout tasks
 * that were due and done. Admin only; reads, never writes.
 *
 * `anonymise` swaps names for "Person 1, 2…" (in order) and leaves the
 * free-text session notes out, since those can name people too.
 */

type UserRow = {
  id: string;
  name: string;
  displayName: string | null;
  role: string;
  kind: string;
  birthday: Date | null;
  isActive: boolean;
};
type PoolRow = {
  id: string;
  category: string;
  name: string;
  muscleGroup: string | null;
  metric: string | null;
  isActive: boolean;
  ownerId: string | null;
};
type ExerciseRow = {
  id: string;
  userId: string;
  category: string;
  name: string;
  implement: string | null;
  unit: string;
  metric: string;
  tracked: boolean;
  isActive: boolean;
};
type PlanRow = {
  userId: string;
  dayOfWeek: number;
  name: string;
  category: string | null;
  muscleGroup: string | null;
  isRest: boolean;
  hiitWorkoutId: string | null;
  sortOrder: number;
  exercises: { poolExerciseId: string; tracked: boolean; metric: string | null; sortOrder: number }[];
};
type RotationRow = {
  userId: string;
  anchorDate: Date;
  restMask: number;
  isActive: boolean;
  slots: { position: number; name: string; category: string | null; muscleGroup: string | null; isRest: boolean }[];
};
type ScheduleRow = {
  userId: string;
  exerciseId: string;
  dayOfWeek: number;
  isActive: boolean;
  isPaused: boolean;
  effectiveFrom: Date;
  endDate: Date | null;
};
type HiitRow = {
  id: string;
  name: string;
  type: string;
  ownerId: string | null;
  approved: boolean;
  capSec: number | null;
  pyramidStart: number | null;
  pyramidEnd: number | null;
  pyramidStep: number | null;
  notes: string | null;
  heroWod: boolean;
  movements: { poolExerciseId: string; reps: number | null; distance: number | null; weight: number | null; position: number }[];
};
type SetRow = {
  exerciseId: string | null;
  poolExerciseId: string | null;
  swappedFromId: string | null;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  distance: number | null;
  meters: number | null;
  seconds: number | null;
  unit: string | null;
  finished: boolean;
};
type SessionRow = {
  userId: string;
  date: Date;
  name: string | null;
  category: string | null;
  workoutType: string | null;
  durationMin: number | null;
  finished: boolean;
  isRest: boolean;
  notes: string | null;
  sourceEventId: string | null;
  completedOn: Date | null;
  sets: SetRow[];
};
type SkipRow = { userId: string; date: Date; slot: string };
type TaskRow = { userId: string; title: string; dueDate: Date; status: string; completedAt: Date | null };

function ageOn(birthday: Date | null, today: string): number | null {
  if (!birthday) return null;
  const b = fromDateColumn(birthday);
  let age = Number(today.slice(0, 4)) - Number(b.slice(0, 4));
  if (today.slice(5) < b.slice(5)) age -= 1;
  return age;
}

const clean = <T extends Record<string, unknown>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;

export async function exportWorkouts(opts: { anonymise: boolean }): Promise<string> {
  await requireAdmin();
  const today = todayISO();

  const [users, pool, exercises, plans, rotations, schedules, hiits, sessions, skips, tasks, units] =
    (await Promise.all([
      prisma.user.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, displayName: true, role: true, kind: true, birthday: true, isActive: true },
      }),
      prisma.poolExercise.findMany({
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
        select: { id: true, category: true, name: true, muscleGroup: true, metric: true, isActive: true, ownerId: true },
      }),
      prisma.exercise.findMany({
        orderBy: [{ userId: "asc" }, { sortOrder: "asc" }],
        select: { id: true, userId: true, category: true, name: true, implement: true, unit: true, metric: true, tracked: true, isActive: true },
      }),
      prisma.plannedWorkout.findMany({
        orderBy: [{ userId: "asc" }, { dayOfWeek: "asc" }, { sortOrder: "asc" }],
        select: {
          userId: true, dayOfWeek: true, name: true, category: true, muscleGroup: true, isRest: true, hiitWorkoutId: true, sortOrder: true,
          exercises: { orderBy: { sortOrder: "asc" }, select: { poolExerciseId: true, tracked: true, metric: true, sortOrder: true } },
        },
      }),
      prisma.workoutRotation.findMany({
        select: {
          userId: true, anchorDate: true, restMask: true, isActive: true,
          slots: { orderBy: { position: "asc" }, select: { position: true, name: true, category: true, muscleGroup: true, isRest: true } },
        },
      }),
      prisma.workoutSchedule.findMany({
        select: { userId: true, exerciseId: true, dayOfWeek: true, isActive: true, isPaused: true, effectiveFrom: true, endDate: true },
      }),
      prisma.hiitWorkout.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, name: true, type: true, ownerId: true, approved: true, capSec: true, pyramidStart: true, pyramidEnd: true,
          pyramidStep: true, notes: true, heroWod: true,
          movements: { orderBy: { position: "asc" }, select: { poolExerciseId: true, reps: true, distance: true, weight: true, position: true } },
        },
      }),
      prisma.workoutSession.findMany({
        orderBy: [{ userId: "asc" }, { date: "asc" }, { createdAt: "asc" }],
        select: {
          userId: true, date: true, name: true, category: true, workoutType: true, durationMin: true, finished: true, isRest: true,
          notes: true, sourceEventId: true, completedOn: true,
          sets: {
            orderBy: [{ createdAt: "asc" }, { setNumber: "asc" }],
            select: {
              exerciseId: true, poolExerciseId: true, swappedFromId: true, setNumber: true, reps: true, weight: true,
              distance: true, meters: true, seconds: true, unit: true, finished: true,
            },
          },
        },
      }),
      prisma.workoutMovementSkip.findMany({ orderBy: { date: "asc" }, select: { userId: true, date: true, slot: true } }),
      prisma.task.findMany({
        where: { category: "EXERCISE" },
        orderBy: [{ userId: "asc" }, { dueDate: "asc" }],
        select: { userId: true, title: true, dueDate: true, status: true, completedAt: true },
      }),
      loadWeightUnits(),
    ])) as [
      UserRow[], PoolRow[], ExerciseRow[], PlanRow[], RotationRow[], ScheduleRow[], HiitRow[],
      SessionRow[], SkipRow[], TaskRow[], Awaited<ReturnType<typeof loadWeightUnits>>,
    ];

  // Names: real ones, or "Person N" in the household's own order.
  const label = new Map<string, string>(
    users.map((u, i) => [u.id, opts.anonymise ? `Person ${i + 1}` : (u.displayName ?? u.name)]),
  );
  const who = (id: string | null | undefined) => (id ? label.get(id) ?? "unknown" : null);
  const poolName = new Map(pool.map((p) => [p.id, p.name]));
  const exerciseName = new Map(exercises.map((e) => [e.id, e.name]));
  const movement = (s: { exerciseId: string | null; poolExerciseId: string | null }) =>
    s.poolExerciseId ? poolName.get(s.poolExerciseId) ?? s.poolExerciseId
      : s.exerciseId ? exerciseName.get(s.exerciseId) ?? s.exerciseId
      : null;

  const out = {
    generatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    today,
    anonymised: opts.anonymise,
    notes: {
      days: "dayOfWeek 0 = Sunday .. 6 = Saturday",
      sets: "one row per logged set; older logs often hold only the top set",
      tasks: "workout tasks generated from plans: due date and status (COMPLETE, SKIPPED, PENDING)",
    },
    weightUnits: units,
    people: users.map((u) => clean({
      name: who(u.id),
      role: u.role,
      kind: u.kind,
      age: ageOn(u.birthday, today),
      active: u.isActive,
    })),
    movementPool: pool.map((p) => clean({
      id: p.id,
      name: p.name,
      category: p.category,
      muscleGroup: p.muscleGroup,
      logsAs: p.metric,
      active: p.isActive,
      ownedBy: who(p.ownerId),
    })),
    olderExercises: exercises.map((e) => clean({
      id: e.id,
      person: who(e.userId),
      name: e.name,
      category: e.category,
      implement: e.implement,
      unit: e.unit,
      metric: e.metric,
      tracked: e.tracked,
      active: e.isActive,
    })),
    plans: plans.map((p) => clean({
      person: who(p.userId),
      dayOfWeek: p.dayOfWeek,
      name: p.name,
      category: p.category,
      muscleGroup: p.muscleGroup,
      rest: p.isRest || undefined,
      hiitWorkout: p.hiitWorkoutId ? hiits.find((h) => h.id === p.hiitWorkoutId)?.name ?? p.hiitWorkoutId : null,
      movements: p.exercises.map((x) => clean({
        name: poolName.get(x.poolExerciseId) ?? x.poolExerciseId,
        tracked: x.tracked,
        metric: x.metric,
      })),
    })),
    rotations: rotations.map((r) => ({
      person: who(r.userId),
      anchorDate: fromDateColumn(r.anchorDate),
      restMask: r.restMask,
      active: r.isActive,
      slots: r.slots.map((s) => clean({ position: s.position, name: s.name, category: s.category, muscleGroup: s.muscleGroup, rest: s.isRest || undefined })),
    })),
    olderWeeklySchedules: schedules.map((s) => clean({
      person: who(s.userId),
      exercise: exerciseName.get(s.exerciseId) ?? s.exerciseId,
      dayOfWeek: s.dayOfWeek,
      active: s.isActive,
      paused: s.isPaused || undefined,
      from: fromDateColumn(s.effectiveFrom),
      until: s.endDate ? fromDateColumn(s.endDate) : null,
    })),
    hiitWorkouts: hiits.map((h) => clean({
      name: h.name,
      type: h.type,
      ownedBy: who(h.ownerId),
      approved: h.approved,
      capSec: h.capSec,
      pyramid: h.pyramidStart != null ? { start: h.pyramidStart, end: h.pyramidEnd, step: h.pyramidStep } : null,
      notes: opts.anonymise ? null : h.notes,
      heroWod: h.heroWod || undefined,
      movements: h.movements.map((m) => clean({
        name: poolName.get(m.poolExerciseId) ?? m.poolExerciseId,
        reps: m.reps,
        distance: m.distance,
        weight: m.weight,
      })),
    })),
    sessions: sessions.map((s) => clean({
      person: who(s.userId),
      date: fromDateColumn(s.date),
      name: s.name,
      category: s.category,
      type: s.workoutType,
      minutes: s.durationMin,
      finished: s.finished,
      rest: s.isRest || undefined,
      fromCalendar: s.sourceEventId ? true : undefined,
      completedOn: s.completedOn ? fromDateColumn(s.completedOn) : null,
      notes: opts.anonymise ? null : s.notes,
      sets: s.sets.map((x) => clean({
        movement: movement(x),
        swappedFrom: x.swappedFromId ? poolName.get(x.swappedFromId) ?? x.swappedFromId : null,
        set: x.setNumber,
        reps: x.reps,
        weight: x.weight,
        distance: x.distance,
        meters: x.meters,
        seconds: x.seconds,
        unit: x.unit,
        finished: x.finished ? undefined : false,
      })),
    })),
    skippedMovements: skips.map((k) => ({ person: who(k.userId), date: fromDateColumn(k.date), slot: k.slot })),
    workoutTasks: tasks.map((t) => clean({
      person: who(t.userId),
      due: fromDateColumn(t.dueDate),
      title: t.title,
      status: t.status,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    })),
  };

  return JSON.stringify(out, null, 1);
}
