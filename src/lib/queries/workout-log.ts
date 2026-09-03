import "server-only";
import { prisma } from "@/lib/prisma";
import { dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";
import { metricUnit, type Metric } from "@/lib/workouts/catalog";
import { loadWorkoutUnitSystem } from "@/lib/queries/workouts";

/**
 * The exercises scheduled for a person on a day, with any weight/reps already
 * logged — the same set the web personal view's scheduled-lift prompt shows
 * (queries/workouts.ts `today.scheduled`), pulled for one person without running
 * the whole household board. Phase 1 logs weight × reps per exercise, matching
 * that prompt; other metrics / multi-set / HIIT come later.
 */
export type TodayLogExercise = {
  exerciseId: string;
  name: string;
  unit: string;
  metric: string;
  logged: { weight: number | null; reps: number | null } | null;
};

export async function loadTodayExercises(
  userId: string,
  dayISO: string,
): Promise<TodayLogExercise[]> {
  const dow = dayOfWeek(dayISO);

  const [exercises, schedules, sets] = await Promise.all([
    prisma.exercise.findMany({
      where: { userId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, unit: true, metric: true },
    }),
    prisma.workoutSchedule.findMany({
      where: { userId, isActive: true },
      select: {
        exerciseId: true,
        dayOfWeek: true,
        isPaused: true,
        endDate: true,
      },
    }),
    prisma.sessionSet.findMany({
      where: {
        session: { userId, date: toDateColumn(dayISO) },
        exerciseId: { not: null },
        setNumber: 1,
      },
      select: { exerciseId: true, weight: true, reps: true },
    }),
  ]);

  const sched = new Map<
    string,
    { days: number[]; paused: boolean; endDate: string | null }
  >();
  for (const s of schedules) {
    const e = sched.get(s.exerciseId) ?? {
      days: [],
      paused: false,
      endDate: null,
    };
    e.days.push(s.dayOfWeek);
    e.paused = e.paused || s.isPaused;
    e.endDate = s.endDate ? fromDateColumn(s.endDate) : e.endDate;
    sched.set(s.exerciseId, e);
  }

  const logged = new Map(
    sets
      .filter((s) => s.exerciseId)
      .map((s) => [s.exerciseId as string, s]),
  );

  return exercises
    .filter((e) => {
      const sc = sched.get(e.id);
      return (
        !!sc &&
        !sc.paused &&
        sc.days.includes(dow) &&
        (!sc.endDate || sc.endDate >= dayISO)
      );
    })
    .map((e) => {
      const l = logged.get(e.id);
      return {
        exerciseId: e.id,
        name: e.name,
        unit: e.unit,
        metric: e.metric as string,
        logged: l ? { weight: l.weight ?? null, reps: l.reps ?? null } : null,
      };
    });
}

/**
 * Today's planned workout for a person (e.g. "Legs") with its pool movements —
 * the model most people schedule with. Each movement logs a single value typed
 * by its metric, with the unit resolved from the household unit system, and any
 * value already logged today prefilled.
 */
export type PlannedMovement = {
  poolExerciseId: string;
  name: string;
  metric: string;
  unit: string;
  value: number | null;
};

export type TodayPlanned = {
  plannedWorkoutId: string;
  name: string;
  exercises: PlannedMovement[];
} | null;

function valueForMetric(
  s: {
    weight: number | null;
    reps: number | null;
    distance: number | null;
    meters: number | null;
    seconds: number | null;
  },
  metric: string,
): number | null {
  switch (metric) {
    case "WEIGHT":
      return s.weight;
    case "REPS":
      return s.reps;
    case "DISTANCE":
      return s.distance;
    case "METERS":
      return s.meters;
    case "DURATION":
      return s.seconds;
    default:
      return null;
  }
}

export async function loadTodayPlannedWorkout(
  userId: string,
  dayISO: string,
): Promise<TodayPlanned> {
  const dow = dayOfWeek(dayISO);
  const system = await loadWorkoutUnitSystem();

  const plan = await prisma.plannedWorkout.findFirst({
    where: { userId, dayOfWeek: dow, isRest: false },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      exercises: {
        orderBy: { sortOrder: "asc" },
        select: {
          poolExerciseId: true,
          metric: true,
          poolExercise: { select: { name: true } },
        },
      },
    },
  });
  if (!plan || plan.exercises.length === 0) return null;

  const sets = await prisma.sessionSet.findMany({
    where: {
      session: { userId, date: toDateColumn(dayISO) },
      poolExerciseId: { not: null },
    },
    select: {
      poolExerciseId: true,
      weight: true,
      reps: true,
      distance: true,
      meters: true,
      seconds: true,
    },
  });
  const loggedByPool = new Map(
    sets.filter((s) => s.poolExerciseId).map((s) => [s.poolExerciseId as string, s]),
  );

  const exercises: PlannedMovement[] = plan.exercises.map((pe) => {
    const metric = (pe.metric ?? "WEIGHT") as string;
    const unit = metricUnit(metric as Metric, system);
    const logged = loggedByPool.get(pe.poolExerciseId);
    return {
      poolExerciseId: pe.poolExerciseId,
      name: pe.poolExercise.name,
      metric,
      unit,
      value: logged ? valueForMetric(logged, metric) : null,
    };
  });

  return { plannedWorkoutId: plan.id, name: plan.name, exercises };
}

/**
 * A person's workout history and per-movement weight progress, for the Workouts
 * page. Series = max weight per day per pool movement (the graph); history =
 * recent sessions with a short label and result line.
 */
export type GraphPoint = { date: string; value: number };
export type ProgressSeries = {
  poolExerciseId: string;
  name: string;
  unit: string;
  points: GraphPoint[];
};
export type WorkoutHistoryEntry = {
  id: string;
  date: string;
  label: string;
  result: string;
  isRest: boolean;
};
export type WorkoutProgress = {
  series: ProgressSeries[];
  history: WorkoutHistoryEntry[];
};

export async function loadWorkoutProgress(
  userId: string,
): Promise<WorkoutProgress> {
  const system = await loadWorkoutUnitSystem();
  const weightUnit = metricUnit("WEIGHT" as Metric, system);

  const [wSets, recent] = await Promise.all([
    prisma.sessionSet.findMany({
      where: {
        session: { userId },
        weight: { not: null },
        poolExerciseId: { not: null },
      },
      select: {
        weight: true,
        poolExerciseId: true,
        poolExercise: { select: { name: true } },
        session: { select: { date: true } },
      },
    }),
    prisma.workoutSession.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        date: true,
        name: true,
        isRest: true,
        sets: {
          orderBy: { setNumber: "asc" },
          select: {
            weight: true,
            reps: true,
            unit: true,
            poolExercise: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  // Series: max weight per day per pool movement.
  const meta = new Map<string, string>();
  const perDay = new Map<string, Map<string, number>>();
  for (const s of wSets) {
    if (s.weight == null || !s.poolExerciseId || !s.poolExercise) continue;
    const id = s.poolExerciseId;
    if (!meta.has(id)) meta.set(id, s.poolExercise.name);
    const d = fromDateColumn(s.session.date);
    const m = perDay.get(id) ?? new Map<string, number>();
    m.set(d, Math.max(m.get(d) ?? 0, s.weight));
    perDay.set(id, m);
  }
  const series: ProgressSeries[] = [...meta.entries()]
    .map(([id, name]) => ({
      poolExerciseId: id,
      name,
      unit: weightUnit,
      points: [...perDay.get(id)!.entries()]
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    }))
    .filter((s) => s.points.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const history: WorkoutHistoryEntry[] = recent.map((s) => ({
    id: s.id,
    date: fromDateColumn(s.date),
    label: s.isRest ? "Rest day" : s.name?.trim() || "Workout",
    result: s.isRest ? "" : historyResult(s.sets),
    isRest: s.isRest,
  }));

  return { series, history };
}

function historyResult(
  sets: {
    weight: number | null;
    reps: number | null;
    unit: string | null;
    poolExercise: { name: string } | null;
  }[],
): string {
  if (sets.length === 0) return "";
  if (sets.length === 1) {
    const x = sets[0];
    if (x.weight != null && x.reps != null) {
      return `${trimNum(x.weight)}${x.unit ?? ""} × ${x.reps}`;
    }
    if (x.weight != null) return `${trimNum(x.weight)}${x.unit ?? ""}`;
    return x.poolExercise?.name ?? "Logged";
  }
  const names = [
    ...new Set(sets.map((x) => x.poolExercise?.name).filter((n): n is string => !!n)),
  ];
  if (names.length === 0) return `${sets.length} movements`;
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} +${names.length - 3}` : shown;
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
