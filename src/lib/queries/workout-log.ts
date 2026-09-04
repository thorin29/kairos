import "server-only";
import { prisma } from "@/lib/prisma";
import { slotForDate } from "@/lib/workouts/rotation";
import { formatHiitMovement, WORKOUT_TYPE_LABEL, METRIC_LABEL_SHORT, defaultMetricFor, metricChoicesFor, MUSCLE_GROUPS, MUSCLE_GROUP_LABEL, CATEGORY_LABEL, METRIC_ONLY_CATEGORIES } from "@/lib/workouts/catalog";
import { addDays, todayISO, dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";
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
  /** Which movement to show by default: today's tracked weights, or the next
   *  day that has one. Null when there's nothing to graph. */
  defaultId: string | null;
  history: WorkoutHistoryEntry[];
};

export async function loadWorkoutProgress(
  userId: string,
  todayISO: string,
): Promise<WorkoutProgress> {
  const system = await loadWorkoutUnitSystem();
  const weightUnit = metricUnit("WEIGHT" as Metric, system);
  const dow = dayOfWeek(todayISO);

  const [plans, recent] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId },
      select: {
        dayOfWeek: true,
        isRest: true,
        category: true,
        exercises: {
          orderBy: { sortOrder: "asc" },
          select: {
            poolExerciseId: true,
            tracked: true,
            metric: true,
            poolExercise: { select: { name: true, category: true } },
          },
        },
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

  // The person's tracked weight movements (the only ones graphed / selectable).
  const isWeight = (poolCat: string | null, metric: string | null) =>
    poolCat === "WEIGHTS" || metric === "WEIGHT";
  const trackedNames = new Map<string, string>();
  for (const p of plans) {
    for (const e of p.exercises) {
      if (e.tracked && isWeight(e.poolExercise.category, e.metric)) {
        trackedNames.set(e.poolExerciseId, e.poolExercise.name);
      }
    }
  }
  const trackedIds = [...trackedNames.keys()];

  // Max weight per day for those movements.
  const wSets = trackedIds.length
    ? await prisma.sessionSet.findMany({
        where: {
          session: { userId },
          weight: { not: null },
          poolExerciseId: { in: trackedIds },
        },
        select: {
          weight: true,
          poolExerciseId: true,
          session: { select: { date: true } },
        },
      })
    : [];
  const perDay = new Map<string, Map<string, number>>();
  for (const s of wSets) {
    if (s.weight == null || !s.poolExerciseId) continue;
    const d = fromDateColumn(s.session.date);
    const m = perDay.get(s.poolExerciseId) ?? new Map<string, number>();
    m.set(d, Math.max(m.get(d) ?? 0, s.weight));
    perDay.set(s.poolExerciseId, m);
  }

  const series: ProgressSeries[] = [...trackedNames.entries()]
    .map(([id, name]) => ({
      poolExerciseId: id,
      name,
      unit: weightUnit,
      points: [...(perDay.get(id)?.entries() ?? [])]
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Default: today's tracked weights, else the next day that has some.
  const weightsOn = (d: number): string[] =>
    plans
      .filter((p) => p.dayOfWeek === d && p.category === "WEIGHTS" && !p.isRest)
      .flatMap((p) =>
        p.exercises
          .filter((e) => e.tracked && isWeight(e.poolExercise.category, e.metric))
          .map((e) => e.poolExerciseId),
      );
  let defaultId: string | null = weightsOn(dow)[0] ?? null;
  if (!defaultId) {
    for (let i = 1; i <= 7; i++) {
      const found = weightsOn((dow + i) % 7)[0];
      if (found) {
        defaultId = found;
        break;
      }
    }
  }
  if (!defaultId) {
    defaultId =
      series.find((s) => s.points.length > 0)?.poolExerciseId ??
      series[0]?.poolExerciseId ??
      null;
  }

  const history: WorkoutHistoryEntry[] = recent.map((s) => ({
    id: s.id,
    date: fromDateColumn(s.date),
    label: s.isRest ? "Rest day" : s.name?.trim() || "Workout",
    result: s.isRest ? "" : historyResult(s.sets),
    isRest: s.isRest,
  }));

  return { series, defaultId, history };
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

/**
 * Everything the "Log a different workout" form needs: the loggable categories
 * (each with its metric choices and units) and the shared exercise pool.
 * Mirrors the web's CustomWorkoutForm config (workouts-grid.tsx). HIIT is
 * omitted for now (it uses a dedicated builder).
 */
export type MetricOption = { key: string; label: string; unit: string };
export type LogCategory = {
  key: string;
  label: string;
  isPool: boolean;
  metrics: MetricOption[];
  load: boolean;
};
export type PoolExerciseLite = { id: string; name: string; category: string };
export type WorkoutPool = {
  categories: LogCategory[];
  exercises: PoolExerciseLite[];
};

const CATEGORY_LABELS: Record<string, string> = {
  WEIGHTS: "Weights",
  RUNNING: "Running",
  ROWING: "Rowing",
  SPORT: "Sport",
  STRETCHING: "Stretching",
  ISOMETRIC: "Isometric",
  RUCKING: "Rucking",
};
const METRIC_LABELS: Record<string, string> = {
  DURATION: "Time",
  REPS: "Reps / rounds",
  DISTANCE: "Distance",
  METERS: "Meters",
  WEIGHT: "Weight",
};
// key: [category], value: metric config (locked or choices, + load, + isPool).
const CAT_CFG: Record<
  string,
  { locked?: string; choices?: string[]; load?: boolean; pool: boolean }
> = {
  WEIGHTS: { locked: "WEIGHT", pool: true },
  RUNNING: { choices: ["DISTANCE", "METERS"], pool: false },
  ROWING: { locked: "METERS", pool: false },
  RUCKING: { locked: "DISTANCE", load: true, pool: false },
  SPORT: { choices: ["DURATION", "REPS"], pool: true },
  STRETCHING: { choices: ["DURATION", "REPS"], pool: true },
  ISOMETRIC: { choices: ["DURATION", "REPS"], pool: true },
};
// Order shown in the picker.
const CAT_ORDER = ["WEIGHTS", "RUNNING", "ROWING", "RUCKING", "SPORT", "STRETCHING", "ISOMETRIC"];

function unitForMetric(metric: string, system: string): string {
  switch (metric) {
    case "WEIGHT":
      return system === "metric" ? "kg" : "lb";
    case "DISTANCE":
      return system === "metric" ? "km" : "mi";
    case "METERS":
      return "m";
    case "REPS":
      return "rep";
    default:
      return "";
  }
}

export async function loadWorkoutPool(): Promise<WorkoutPool> {
  const system = await loadWorkoutUnitSystem();

  const categories: LogCategory[] = CAT_ORDER.map((key) => {
    const cfg = CAT_CFG[key];
    const metricKeys = cfg.locked ? [cfg.locked] : (cfg.choices ?? ["REPS"]);
    return {
      key,
      label: CATEGORY_LABELS[key] ?? key,
      isPool: cfg.pool,
      load: !!cfg.load,
      metrics: metricKeys.map((m) => ({
        key: m,
        label: METRIC_LABELS[m] ?? m,
        unit: unitForMetric(m, system),
      })),
    };
  });

  const exercises = await prisma.poolExercise.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true },
  });

  return { categories, exercises };
}

/** Named workouts this person can browse: the shared approved library plus
 *  their own. Mirrors the web "Browse workouts" list. */
export type BrowsableWorkout = {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  personal: boolean;
  heroWod: boolean;
  detail: string;
};

export async function loadBrowsableWorkouts(
  userId: string,
): Promise<BrowsableWorkout[]> {
  const rows = await prisma.hiitWorkout.findMany({
    where: {
      OR: [{ ownerId: null, approved: true }, { ownerId: userId }],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      heroWod: true,
      notes: true,
      ownerId: true,
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
  });

  return rows.map((w) => {
    const moves = w.movements.map((m) =>
      formatHiitMovement({
        name: m.poolExercise?.name ?? "—",
        reps: m.reps,
        distance: m.distance,
        weight: m.weight,
      }),
    );
    const detail = w.notes?.trim()
      ? w.notes.trim()
      : moves.length > 0
        ? moves.join(", ")
        : "No details yet.";
    return {
      id: w.id,
      name: w.name,
      type: w.type as string,
      typeLabel: (WORKOUT_TYPE_LABEL as Record<string, string>)[w.type] ?? (w.type as string),
      personal: w.ownerId === userId,
      heroWod: w.heroWod,
      detail,
    };
  });
}

/** The person's weekly plan (7 days), each workout flattened to a name + a
 *  one-line detail, mirroring the web PlanBuilder rows. */
export type PlanWorkoutLite = {
  id: string;
  name: string;
  isRest: boolean;
  detail: string;
};
export type PlanDayLite = { day: number; workouts: PlanWorkoutLite[] };

export async function loadPlan(userId: string): Promise<PlanDayLite[]> {
  const rows = await prisma.plannedWorkout.findMany({
    where: { userId },
    orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      category: true,
      isRest: true,
      hiitWorkout: {
        select: {
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
      },
      exercises: {
        orderBy: { sortOrder: "asc" },
        select: { tracked: true, poolExercise: { select: { name: true } } },
      },
    },
  });

  const byDay = new Map<number, PlanWorkoutLite[]>();
  for (let d = 0; d < 7; d++) byDay.set(d, []);
  for (const w of rows) {
    byDay.get(w.dayOfWeek)?.push({
      id: w.id,
      name: w.name,
      isRest: w.isRest,
      detail: planDetail(w),
    });
  }
  return [...byDay.entries()].map(([day, workouts]) => ({ day, workouts }));
}

function planDetail(w: {
  category: string | null;
  isRest: boolean;
  hiitWorkout: {
    type: string;
    movements: { reps: number | null; distance: number | null; weight: number | null; poolExercise: { name: string } | null }[];
  } | null;
  exercises: { tracked: boolean; poolExercise: { name: string } | null }[];
}): string {
  if (w.hiitWorkout) {
    const label = (WORKOUT_TYPE_LABEL as Record<string, string>)[w.hiitWorkout.type] ?? w.hiitWorkout.type;
    if (w.hiitWorkout.movements.length === 0) return label;
    const moves = w.hiitWorkout.movements
      .map((m) => formatHiitMovement({ name: m.poolExercise?.name ?? "—", reps: m.reps, distance: m.distance, weight: m.weight }))
      .join(", ");
    return `${label} · ${moves}`;
  }
  if (w.isRest) return "";
  if (w.exercises.length > 0) {
    return w.exercises
      .map((e) => (e.tracked ? e.poolExercise?.name ?? "—" : `${e.poolExercise?.name ?? "—"} (no log)`))
      .join(" · ");
  }
  if (w.category) {
    const m = defaultMetricFor(w.category as never);
    return `Log ${(METRIC_LABEL_SHORT as Record<string, string>)[m].toLowerCase()} on completion`;
  }
  return "Legacy workout";
}

/** Everything the "Add workout" plan picker needs. */
export type PlanMetric = { key: string; label: string };
export type PlanCategoryOption = {
  key: string;
  label: string;
  kind: string; // "weights" | "hiit" | "metricOnly" | "pool"
  metrics: PlanMetric[];
  defaultMetric: string;
};
export type PlanOptions = {
  categories: PlanCategoryOption[];
  muscleGroups: { key: string; label: string }[];
  exercises: { id: string; name: string; category: string; muscleGroup: string | null }[];
  hiitWorkouts: { id: string; name: string; personal: boolean }[];
};

const PLAN_CAT_ORDER = ["WEIGHTS", "HIIT", "ISOMETRIC", "STRETCHING", "SPORT", "RUNNING", "ROWING", "RUCKING"];

export async function loadPlanOptions(userId: string): Promise<PlanOptions> {
  const categories: PlanCategoryOption[] = PLAN_CAT_ORDER.map((c) => {
    const kind = c === "WEIGHTS" ? "weights"
      : c === "HIIT" ? "hiit"
      : (METRIC_ONLY_CATEGORIES as string[]).includes(c) ? "metricOnly"
      : "pool";
    const choices = metricChoicesFor(c as never) as string[];
    return {
      key: c,
      label: (CATEGORY_LABEL as Record<string, string>)[c] ?? c,
      kind,
      metrics: choices.map((m) => ({ key: m, label: (METRIC_LABEL_SHORT as Record<string, string>)[m] ?? m })),
      defaultMetric: defaultMetricFor(c as never) as string,
    };
  });

  const [exRows, hiit] = await Promise.all([
    prisma.poolExercise.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, muscleGroup: true },
    }),
    loadBrowsableWorkouts(userId),
  ]);

  return {
    categories,
    muscleGroups: (MUSCLE_GROUPS as string[]).map((m) => ({
      key: m,
      label: (MUSCLE_GROUP_LABEL as Record<string, string>)[m] ?? m,
    })),
    exercises: exRows.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category as string,
      muscleGroup: (e.muscleGroup as string | null) ?? null,
    })),
    hiitWorkouts: hiit.map((w) => ({ id: w.id, name: w.name, personal: w.personal })),
  };
}

/** The person's rotation (if any), with a 10-day preview computed here so the
 *  app doesn't reimplement the cycle math. */
export type RotationSlotLite = { id: string; position: number; name: string; label: string; isRest: boolean };
export type RotationPreviewDay = { date: string; label: string; rest: boolean };
export type RotationView = {
  active: boolean;
  anchorISO: string | null;
  restMask: number;
  slots: RotationSlotLite[];
  preview: RotationPreviewDay[];
};

export async function loadRotation(userId: string): Promise<RotationView> {
  const row = await prisma.workoutRotation.findUnique({
    where: { userId },
    select: {
      isActive: true,
      anchorDate: true,
      restMask: true,
      slots: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, name: true, category: true, muscleGroup: true, isRest: true },
      },
    },
  });

  if (!row || !row.isActive) {
    return { active: false, anchorISO: null, restMask: 0, slots: [], preview: [] };
  }

  const anchorISO = fromDateColumn(row.anchorDate);
  const slots: RotationSlotLite[] = row.slots.map((s) => ({
    id: s.id,
    position: s.position,
    name: s.name,
    label: s.isRest
      ? "Rest"
      : s.muscleGroup
        ? (MUSCLE_GROUP_LABEL as Record<string, string>)[s.muscleGroup] ?? s.name
        : s.name,
    isRest: s.isRest,
  }));

  const shape = {
    anchorISO,
    restMask: row.restMask,
    slots: row.slots.map((s) => ({
      position: s.position,
      name: s.name,
      category: s.category as string | null,
      muscleGroup: s.muscleGroup as string | null,
      isRest: s.isRest,
    })),
  };
  const preview: RotationPreviewDay[] = Array.from({ length: 10 }, (_, i) => {
    const iso = addDays(todayISO(), i);
    const r = slotForDate(shape, iso);
    const label =
      r.kind === "workout"
        ? r.slot.muscleGroup
          ? (MUSCLE_GROUP_LABEL as Record<string, string>)[r.slot.muscleGroup] ?? r.slot.name
          : r.slot.name
        : "Rest";
    return { date: iso, label, rest: r.kind !== "workout" };
  });

  return { active: true, anchorISO, restMask: row.restMask, slots, preview };
}
