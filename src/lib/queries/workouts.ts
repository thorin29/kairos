import "server-only";
import { prisma } from "@/lib/prisma";
import { dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import {
  CATEGORY_LABEL,
  LINE_COLORS,
  MUSCLE_GROUPS,
  UNIT_SYSTEM_KEY,
  DEFAULT_WEIGHT_UNIT,
  WORKOUT_TYPE_LABEL,
  defaultMetricFor,
  metricUnit,
  weightUnitKey,
  type Implement,
  type Metric,
  type MuscleGroup,
  type UnitSystem,
  type WeightUnit,
  type WorkoutCategory,
  type WorkoutType,
} from "@/lib/workouts/catalog";

export type GraphSeries = {
  exerciseId: string;
  name: string;
  unit: string;
  color: string;
  points: { date: string; value: number }[];
};

export type ExerciseDef = {
  id: string;
  name: string;
  category: WorkoutCategory;
  implement: Implement | null;
  unit: string;
  metric: Metric;
  tracked: boolean;
  weekdays: number[];
  paused: boolean;
  endDate: string | null;
};

export type TodayExercise = {
  exerciseId: string;
  name: string;
  unit: string;
  metric: Metric;
  logged: { weight: number | null; reps: number | null } | null;
};

export type Reminder = { kind: "paused" | "ending" | "ended"; text: string };

export type TodayWorkout = {
  id: string;
  label: string;
  result: string;
};

export type HistoryEntry = {
  id: string;
  dateISO: string;
  label: string;
  result: string;
  isRest: boolean;
};

export type PlanExercise = {
  id: string;
  poolExerciseId: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  tracked: boolean;
  metric: Metric | null;
  unit: string;
};

export type PlanWorkout = {
  id: string;
  name: string;
  category: WorkoutCategory | null;
  muscleGroup: MuscleGroup | null;
  isRest: boolean;
  exercises: PlanExercise[];
};

export type PlanDay = { day: number; workouts: PlanWorkout[] };

export type PersonWorkout = {
  user: { id: string; name: string; color: string; avatarPath: string | null };
  categories: WorkoutCategory[];
  exercises: ExerciseDef[];
  weightSeries: GraphSeries[];
  today: { scheduled: TodayExercise[]; workedOut: boolean; rested: boolean };
  todayWorkouts: TodayWorkout[];
  history: HistoryEntry[];
  plan: PlanDay[];
  todayPlanned: { id: string; name: string }[];
  reminders: Reminder[];
};

export type WorkoutsBoard = {
  people: PersonWorkout[];
  unitSystem: UnitSystem;
};

export async function loadWorkoutsBoard(todayISO: string): Promise<WorkoutsBoard> {
  const dow = dayOfWeek(todayISO);
  const today = toDateColumn(todayISO);

  const [people, unitRaw, weightUnits] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true, color: true, avatarPath: true },
    }),
    getSetting(UNIT_SYSTEM_KEY),
    loadWeightUnits(),
  ]);

  const cards: PersonWorkout[] = [];

  for (const person of people) {
    const [exercises, schedules, weightSets, task, todaySessions, plannedRows, recentSessions] =
      await Promise.all([
      prisma.exercise.findMany({
        where: { userId: person.id, isActive: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.workoutSchedule.findMany({
        where: { userId: person.id },
        select: { exerciseId: true, dayOfWeek: true, isPaused: true, endDate: true },
      }),
      prisma.sessionSet.findMany({
        where: {
          weight: { not: null },
          poolExerciseId: { not: null },
          session: { userId: person.id },
          poolExercise: { category: "WEIGHTS" },
        },
        select: {
          poolExerciseId: true,
          weight: true,
          session: { select: { date: true } },
          poolExercise: { select: { name: true, muscleGroup: true } },
        },
      }),
      prisma.task.findFirst({
        where: { userId: person.id, category: "EXERCISE", dueDate: today },
        select: { status: true },
      }),
      prisma.workoutSession.findMany({
        where: { userId: person.id, date: today },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          workoutType: true,
          isRest: true,
          sets: {
            select: {
              exerciseId: true,
              weight: true,
              reps: true,
              distance: true,
              meters: true,
              seconds: true,
              unit: true,
              exercise: { select: { name: true } },
            },
          },
        },
      }),
      prisma.plannedWorkout.findMany({
        where: { userId: person.id },
        orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          dayOfWeek: true,
          name: true,
          category: true,
          muscleGroup: true,
          isRest: true,
          exercises: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              poolExerciseId: true,
              tracked: true,
              metric: true,
              poolExercise: { select: { name: true, muscleGroup: true } },
            },
          },
        },
      }),
      prisma.workoutSession.findMany({
        where: { userId: person.id, date: { lt: today } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          id: true,
          name: true,
          category: true,
          workoutType: true,
          isRest: true,
          date: true,
          sets: {
            select: {
              exerciseId: true,
              weight: true,
              reps: true,
              distance: true,
              meters: true,
              seconds: true,
              unit: true,
              exercise: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const exRows = exercises as unknown as {
      id: string; name: string; unit: string; implement: string | null;
      category: string; metric: string; tracked: boolean;
    }[];
    const wSets = weightSets as unknown as {
      poolExerciseId: string;
      weight: number | null;
      session: { date: Date };
      poolExercise: { name: string; muscleGroup: MuscleGroup | null } | null;
    }[];
    const sessions = (todaySessions ?? []) as unknown as SessShape[];
    // Prefill for the scheduled-lift prompt: what's already logged today for
    // each exercise, gathered across every session on the day.
    const tSets = sessions.flatMap((s) => s.sets);

    // schedule lookup per exercise
    const schedByExercise = new Map<string, { days: number[]; paused: boolean; endDate: string | null }>();
    for (const s of schedules) {
      const entry = schedByExercise.get(s.exerciseId) ?? { days: [], paused: false, endDate: null };
      entry.days.push(s.dayOfWeek);
      entry.paused = entry.paused || s.isPaused;
      entry.endDate = s.endDate ? fromDateColumn(s.endDate) : entry.endDate;
      schedByExercise.set(s.exerciseId, entry);
    }

    const defs: ExerciseDef[] = exRows.map((e) => {
      const sched = schedByExercise.get(e.id);
      return {
        id: e.id,
        name: e.name,
        category: e.category as WorkoutCategory,
        implement: (e.implement as Implement) ?? null,
        unit: e.unit,
        metric: e.metric as Metric,
        tracked: e.tracked,
        weekdays: sched?.days.sort((a, b) => a - b) ?? [],
        paused: sched?.paused ?? false,
        endDate: sched?.endDate ?? null,
      };
    });

    const categories = [...new Set(defs.map((d) => d.category))];

    // Per-person progress: max weight per pool movement per day. Scoped to
    // today's planned movements when there's a plan (so the card shows where
    // you're at for today's lifts); otherwise every movement they've logged.
    const movMeta = new Map<string, { name: string; muscleGroup: MuscleGroup | null }>();
    const perMovementDay = new Map<string, Map<string, number>>();
    for (const set of wSets) {
      if (set.weight == null || !set.poolExercise) continue;
      const id = set.poolExerciseId;
      if (!movMeta.has(id)) {
        movMeta.set(id, {
          name: set.poolExercise.name,
          muscleGroup: set.poolExercise.muscleGroup,
        });
      }
      const d = fromDateColumn(set.session.date);
      const m = perMovementDay.get(id) ?? new Map<string, number>();
      m.set(d, Math.max(m.get(d) ?? 0, set.weight));
      perMovementDay.set(id, m);
    }

    const allSeries: GraphSeries[] = [...movMeta.entries()]
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([id, meta], i) => ({
        exerciseId: id, // pool movement id — the legend/series key
        name: meta.name,
        unit: meta.muscleGroup ? weightUnits[meta.muscleGroup] : "",
        color: LINE_COLORS[i % LINE_COLORS.length],
        points: [...perMovementDay.get(id)!.entries()]
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => (a.date < b.date ? -1 : 1)),
      }))
      .filter((s) => s.points.length > 0);

    const todayPoolIds = new Set<string>();
    for (const w of plannedRows as unknown as {
      dayOfWeek: number;
      exercises: { poolExerciseId: string }[];
    }[]) {
      if (w.dayOfWeek === dow) {
        for (const e of w.exercises) todayPoolIds.add(e.poolExerciseId);
      }
    }

    let weightSeries: GraphSeries[] = allSeries;
    if (todayPoolIds.size > 0) {
      const scoped = allSeries.filter((s) => todayPoolIds.has(s.exerciseId));
      if (scoped.length > 0) weightSeries = scoped;
    }

    // Today's prompt
    const loggedByExercise = new Map(
      tSets.map((s) => [s.exerciseId, s]),
    );
    const scheduled: TodayExercise[] = defs
      .filter((d) => {
        const sched = schedByExercise.get(d.id);
        return sched && !sched.paused && sched.days.includes(dow) &&
          (!sched.endDate || sched.endDate >= todayISO);
      })
      .map((d) => {
        const logged = loggedByExercise.get(d.id);
        return {
          exerciseId: d.id,
          name: d.name,
          unit: d.unit,
          metric: d.metric,
          logged: logged
            ? { weight: logged.weight ?? null, reps: logged.reps ?? null }
            : null,
        };
      });

    const hasRealWorkout = sessions.some(
      (s) => !s.isRest && (s.sets.length > 0 || (s.name?.trim().length ?? 0) > 0),
    );
    const rested = sessions.some((s) => s.isRest) && !hasRealWorkout;
    const workedOut = task?.status === "COMPLETE" && !rested;

    const todayWorkouts: TodayWorkout[] = sessions
      .filter((s) => !s.isRest && (s.sets.length > 0 || (s.name?.trim().length ?? 0) > 0))
      .map((s) => ({ id: s.id, label: workoutLabel(s), result: workoutResult(s) }));

    const recent = (recentSessions ?? []) as unknown as (SessShape & { date: Date })[];
    const history: HistoryEntry[] = recent.map((s) => ({
      id: s.id,
      dateISO: fromDateColumn(s.date),
      label: s.isRest ? "Rest day" : workoutLabel(s),
      result: s.isRest ? "" : workoutResult(s),
      isRest: s.isRest,
    }));

    // Reminders
    const reminders: Reminder[] = [];
    for (const d of defs) {
      if (d.paused) {
        reminders.push({ kind: "paused", text: `${d.name} is paused — resume when you're back to it.` });
      } else if (d.endDate) {
        if (d.endDate < todayISO) {
          reminders.push({ kind: "ended", text: `${d.name} has ended — set up a new plan when ready.` });
        } else {
          const days = Math.round(
            (Date.parse(`${d.endDate}T00:00:00Z`) - Date.parse(`${todayISO}T00:00:00Z`)) / 86_400_000,
          );
          if (days <= 14) {
            reminders.push({
              kind: "ending",
              text: `${d.name} ends in ${days} day${days === 1 ? "" : "s"} — extend it or plan what's next.`,
            });
          }
        }
      }
    }

    const pRows = plannedRows as unknown as {
      id: string;
      dayOfWeek: number;
      name: string;
      category: WorkoutCategory | null;
      muscleGroup: MuscleGroup | null;
      isRest: boolean;
      exercises: {
        id: string;
        poolExerciseId: string;
        tracked: boolean;
        metric: Metric | null;
        poolExercise: { name: string; muscleGroup: MuscleGroup | null } | null;
      }[];
    }[];
    const plan = Array.from({ length: 7 }, (_, day) => ({
      day,
      workouts: pRows
        .filter((w) => w.dayOfWeek === day)
        .map((w) => ({
          id: w.id,
          name: w.name,
          category: w.category,
          muscleGroup: w.muscleGroup,
          isRest: w.isRest,
          exercises: w.exercises.map((e) => {
            const mg = e.poolExercise?.muscleGroup ?? null;
            return {
              id: e.id,
              poolExerciseId: e.poolExerciseId,
              name: e.poolExercise?.name ?? "—",
              muscleGroup: mg,
              tracked: e.tracked,
              metric: e.metric,
              unit: mg ? weightUnits[mg] : "",
            };
          }),
        })),
    }));
    const todayPlanned = (plan[dow]?.workouts ?? []).filter((w) => !w.isRest);

    cards.push({
      user: {
        id: person.id,
        name: person.displayName ?? person.name,
        color: person.color,
        avatarPath: person.avatarPath,
      },
      categories,
      exercises: defs,
      weightSeries,
      today: { scheduled, workedOut, rested },
      todayWorkouts,
      history,
      plan,
      todayPlanned,
      reminders,
    });
  }

  return {
    people: cards,
    unitSystem: unitRaw === "metric" ? "metric" : "imperial",
  };
}

export async function loadWorkoutUnitSystem(): Promise<UnitSystem> {
  const raw = await getSetting(UNIT_SYSTEM_KEY);
  return raw === "metric" ? "metric" : "imperial";
}

export type WeightUnits = Record<MuscleGroup, WeightUnit>;

/** The per-muscle-group weight unit (lb/kg), set in the pool admin. */
export async function loadWeightUnits(): Promise<WeightUnits> {
  const pairs = await Promise.all(
    MUSCLE_GROUPS.map(async (mg) => {
      const v = await getSetting(weightUnitKey(mg));
      return [mg, v === "kg" ? "kg" : DEFAULT_WEIGHT_UNIT] as const;
    }),
  );
  return Object.fromEntries(pairs) as WeightUnits;
}

export type WorkoutAdminRow = {
  id: string;
  name: string;
  color: string;
  loggedCount: number;
};

export async function loadWorkoutAdmin(): Promise<{
  people: WorkoutAdminRow[];
}> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      workoutSessions: { where: { isRest: false }, select: { id: true } },
    },
  });

  return {
    people: users.map((u) => ({
      id: u.id,
      name: u.displayName ?? u.name,
      color: u.color,
      loggedCount: u.workoutSessions.length,
    })),
  };
}

// --- today's workout list: labels and result summaries -------------------

type SetShape = {
  exerciseId: string;
  weight: number | null;
  reps: number | null;
  distance: number | null;
  meters: number | null;
  seconds: number | null;
  unit: string | null;
  exercise: { name: string } | null;
};

type SessShape = {
  id: string;
  name: string | null;
  category: string | null;
  workoutType: WorkoutType | null;
  isRest: boolean;
  sets: SetShape[];
};

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** What to call a workout in the day's list. */
function workoutLabel(s: SessShape): string {
  if (s.name && s.name.trim()) return s.name.trim();
  if (s.category) return CATEGORY_LABEL[s.category as WorkoutCategory] ?? "Workout";
  if (s.sets.some((x) => x.weight != null)) return "Weights";
  if (s.sets.length > 0) return "Workout";
  return "Worked out";
}

/** A short human summary of what was recorded. */
function workoutResult(s: SessShape): string {
  const sets = s.sets;
  if (s.workoutType) {
    const one = sets[0];
    const tl = WORKOUT_TYPE_LABEL[s.workoutType];
    if (!one) return tl;
    if (s.workoutType === "FOR_TIME" && one.seconds != null) {
      return `${tl} · ${fmtDuration(one.seconds)}`;
    }
    if (one.reps != null) {
      return `${tl} · ${one.reps}${s.workoutType === "AMRAP" ? " rounds" : ""}`;
    }
    return tl;
  }
  if (sets.length === 0) return "";
  if (sets.length > 1) {
    const names = [
      ...new Set(sets.map((x) => x.exercise?.name).filter((n): n is string => !!n)),
    ];
    if (names.length === 0) return `${sets.length} exercises`;
    const shown = names.slice(0, 3).join(", ");
    return names.length > 3 ? `${shown} +${names.length - 3}` : shown;
  }
  const x = sets[0];
  if (x.weight != null && x.reps != null) {
    return `${fmtNum(x.weight)}${x.unit ?? ""} × ${x.reps}`;
  }
  if (x.distance != null) {
    const base = `${fmtNum(x.distance)} ${x.unit ?? ""}`.trim();
    return x.weight != null ? `${base} · ${fmtNum(x.weight)} load` : base;
  }
  if (x.meters != null) return `${fmtNum(x.meters)} m`;
  if (x.seconds != null) return fmtDuration(x.seconds);
  if (x.reps != null) return `${x.reps} reps`;
  if (x.weight != null) return `${fmtNum(x.weight)} ${x.unit ?? ""}`.trim();
  return "";
}

// --- admin: one person's workout records (for cleanup) --------------------

export type PersonRecordExercise = {
  id: string;
  name: string;
  category: WorkoutCategory;
  tracked: boolean;
  days: number[];
};

export type PersonRecordSession = {
  id: string;
  dateISO: string;
  label: string;
  result: string;
  isRest: boolean;
};

export type PersonWorkoutRecords = {
  user: { id: string; name: string; color: string } | null;
  exercises: PersonRecordExercise[];
  planned: { id: string; dayOfWeek: number; name: string }[];
  sessions: PersonRecordSession[];
};

export async function loadPersonWorkoutRecords(
  userId: string,
): Promise<PersonWorkoutRecords> {
  const [user, exercises, schedules, planned, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, displayName: true, color: true },
    }),
    prisma.exercise.findMany({
      where: { userId, isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, category: true, tracked: true },
    }),
    prisma.workoutSchedule.findMany({
      where: { userId },
      select: { exerciseId: true, dayOfWeek: true },
    }),
    prisma.plannedWorkout.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
      select: { id: true, dayOfWeek: true, name: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        name: true,
        category: true,
        isRest: true,
        date: true,
        sets: {
          select: {
            exerciseId: true,
            weight: true,
            reps: true,
            distance: true,
            meters: true,
            seconds: true,
            unit: true,
            exercise: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const daysByExercise = new Map<string, number[]>();
  for (const s of schedules) {
    const arr = daysByExercise.get(s.exerciseId) ?? [];
    arr.push(s.dayOfWeek);
    daysByExercise.set(s.exerciseId, arr);
  }

  const exRows = exercises as unknown as {
    id: string; name: string; category: string; tracked: boolean;
  }[];
  const sessRows = (sessions ?? []) as unknown as (SessShape & { date: Date })[];

  return {
    user: user
      ? { id: user.id, name: user.displayName ?? user.name, color: user.color }
      : null,
    exercises: exRows.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category as WorkoutCategory,
      tracked: e.tracked,
      days: (daysByExercise.get(e.id) ?? []).sort((a, b) => a - b),
    })),
    planned: planned as unknown as { id: string; dayOfWeek: number; name: string }[],
    sessions: sessRows.map((s) => ({
      id: s.id,
      dateISO: fromDateColumn(s.date),
      label: s.isRest ? "Rest day" : workoutLabel(s),
      result: s.isRest ? "" : workoutResult(s),
      isRest: s.isRest,
    })),
  };
}

// --- admin: the exercise pool --------------------------------------------

export type PoolEntry = {
  id: string;
  category: WorkoutCategory;
  name: string;
  muscleGroup: MuscleGroup | null;
  isActive: boolean;
  unit: string; // weights: the muscle group's lb/kg; otherwise ""
};

export async function loadExercisePool(): Promise<PoolEntry[]> {
  const [rows, weightUnits] = await Promise.all([
    prisma.poolExercise.findMany({
      orderBy: [
        { category: "asc" },
        { muscleGroup: "asc" },
        { sortOrder: "asc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        category: true,
        name: true,
        muscleGroup: true,
        isActive: true,
      },
    }),
    loadWeightUnits(),
  ]);
  const list = rows as unknown as Omit<PoolEntry, "unit">[];
  return list.map((p) => ({
    ...p,
    unit:
      p.category === "WEIGHTS" && p.muscleGroup
        ? weightUnits[p.muscleGroup]
        : "",
  }));
}

// --- cross-person comparison --------------------------------------------

export type CompareSeries = {
  id: string;
  name: string;
  color: string;
  unit: string;
  points: { date: string; value: number }[];
};

export type MovementComparison = {
  poolExerciseId: string;
  name: string;
  category: WorkoutCategory;
  muscleGroup: MuscleGroup | null;
  metric: Metric;
  unit: string;
  series: CompareSeries[];
};

/**
 * One entry per pool movement that anyone has logged, each carrying a line per
 * person: their best value per day for that movement. This is what the pool
 * buys us — because every set points at a shared movement, the same lift lines
 * up across people. Duration is charted in minutes; everything else in its own
 * unit. Movements with no logged data are left out.
 */
export async function loadMovementComparisons(): Promise<MovementComparison[]> {
  const [people, unitRaw, sets, weightUnits] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true, color: true },
    }),
    getSetting(UNIT_SYSTEM_KEY),
    prisma.sessionSet.findMany({
      where: { poolExerciseId: { not: null } },
      select: {
        poolExerciseId: true,
        weight: true,
        reps: true,
        distance: true,
        meters: true,
        seconds: true,
        session: { select: { userId: true, date: true } },
        poolExercise: {
          select: { name: true, category: true, muscleGroup: true },
        },
      },
    }),
    loadWeightUnits(),
  ]);

  const unitSystem: UnitSystem = unitRaw === "metric" ? "metric" : "imperial";
  const unitForMovement = (metric: Metric, mg: MuscleGroup | null): string =>
    metric === "WEIGHT" && mg ? weightUnits[mg] : metricUnit(metric, unitSystem);

  const rows = sets as unknown as {
    poolExerciseId: string;
    weight: number | null;
    reps: number | null;
    distance: number | null;
    meters: number | null;
    seconds: number | null;
    session: { userId: string; date: Date };
    poolExercise: {
      name: string;
      category: WorkoutCategory;
      muscleGroup: MuscleGroup | null;
    } | null;
  }[];

  const nameById = new Map<string, string>(
    people.map((p) => [p.id, p.displayName ?? p.name]),
  );
  const colorById = new Map<string, string>(
    people.map((p) => [p.id, p.color]),
  );
  const orderById = new Map<string, number>(
    people.map((p, i) => [p.id, i]),
  );

  const valueOf = (
    r: (typeof rows)[number],
    metric: Metric,
  ): number | null => {
    switch (metric) {
      case "WEIGHT":
        return r.weight;
      case "REPS":
        return r.reps;
      case "DISTANCE":
        return r.distance;
      case "METERS":
        return r.meters;
      case "DURATION":
        return r.seconds != null ? r.seconds / 60 : null;
    }
  };

  // poolExerciseId -> { meta, userId -> (dateISO -> best value) }
  const byMovement = new Map<
    string,
    {
      name: string;
      category: WorkoutCategory;
      muscleGroup: MuscleGroup | null;
      metric: Metric;
      perUser: Map<string, Map<string, number>>;
    }
  >();

  for (const r of rows) {
    if (!r.poolExercise) continue;
    const metric = defaultMetricFor(r.poolExercise.category);
    const value = valueOf(r, metric);
    if (value == null) continue;

    let m = byMovement.get(r.poolExerciseId);
    if (!m) {
      m = {
        name: r.poolExercise.name,
        category: r.poolExercise.category,
        muscleGroup: r.poolExercise.muscleGroup,
        metric,
        perUser: new Map(),
      };
      byMovement.set(r.poolExerciseId, m);
    }

    const uid = r.session.userId;
    const day = fromDateColumn(r.session.date);
    const perDay = m.perUser.get(uid) ?? new Map<string, number>();
    perDay.set(day, Math.max(perDay.get(day) ?? 0, value));
    m.perUser.set(uid, perDay);
  }

  const out: MovementComparison[] = [];
  for (const [poolExerciseId, m] of byMovement) {
    const series: CompareSeries[] = [...m.perUser.entries()]
      .filter(([uid]) => orderById.has(uid))
      .sort((a, b) => (orderById.get(a[0]) ?? 0) - (orderById.get(b[0]) ?? 0))
      .map(([uid, days]) => ({
        id: uid,
        name: nameById.get(uid) ?? "Unknown",
        color: colorById.get(uid) ?? "#0f5c63",
        unit: unitForMovement(m.metric, m.muscleGroup),
        points: [...days.entries()]
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => (a.date < b.date ? -1 : 1)),
      }))
      .filter((s) => s.points.length > 0);

    if (series.length === 0) continue;

    out.push({
      poolExerciseId,
      name: m.name,
      category: m.category,
      muscleGroup: m.muscleGroup,
      metric: m.metric,
      unit: unitForMovement(m.metric, m.muscleGroup),
      series,
    });
  }

  out.sort((a, b) =>
    a.category === b.category
      ? a.name.localeCompare(b.name)
      : CATEGORY_LABEL[a.category].localeCompare(CATEGORY_LABEL[b.category]),
  );

  return out;
}

// --- HIIT / CrossFit named workouts -------------------------------------

export type HiitMovementRow = {
  poolExerciseId: string;
  name: string;
  reps: number | null;
  position: number;
};

export type HiitWorkoutRow = {
  id: string;
  name: string;
  type: WorkoutType;
  capSec: number | null;
  pyramidStart: number | null;
  pyramidEnd: number | null;
  pyramidStep: number | null;
  movements: HiitMovementRow[];
};

/** The shared, approved HIIT/CrossFit workout pool, with their movements. */
export async function loadHiitWorkouts(): Promise<HiitWorkoutRow[]> {
  const rows = (await prisma.hiitWorkout.findMany({
    where: { ownerId: null, approved: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      capSec: true,
      pyramidStart: true,
      pyramidEnd: true,
      pyramidStep: true,
      movements: {
        orderBy: { position: "asc" },
        select: {
          poolExerciseId: true,
          reps: true,
          position: true,
          poolExercise: { select: { name: true } },
        },
      },
    },
  })) as unknown as {
    id: string;
    name: string;
    type: WorkoutType;
    capSec: number | null;
    pyramidStart: number | null;
    pyramidEnd: number | null;
    pyramidStep: number | null;
    movements: {
      poolExerciseId: string;
      reps: number | null;
      position: number;
      poolExercise: { name: string } | null;
    }[];
  }[];

  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type,
    capSec: w.capSec,
    pyramidStart: w.pyramidStart,
    pyramidEnd: w.pyramidEnd,
    pyramidStep: w.pyramidStep,
    movements: w.movements.map((m) => ({
      poolExerciseId: m.poolExerciseId,
      name: m.poolExercise?.name ?? "—",
      reps: m.reps,
      position: m.position,
    })),
  }));
}

export type BoardHiitWorkout = {
  id: string;
  name: string;
  type: WorkoutType;
  ownerId: string | null; // null = shared pool
  movements: HiitMovementRow[];
};

/**
 * For the logging dropdown: the shared/approved pool plus every person's own
 * workouts. The grid narrows to shared + the open person's own.
 */
export async function loadHiitWorkoutsForBoard(): Promise<BoardHiitWorkout[]> {
  const rows = (await prisma.hiitWorkout.findMany({
    where: { OR: [{ ownerId: null, approved: true }, { ownerId: { not: null } }] },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      ownerId: true,
      movements: {
        orderBy: { position: "asc" },
        select: {
          poolExerciseId: true,
          reps: true,
          position: true,
          poolExercise: { select: { name: true } },
        },
      },
    },
  })) as unknown as {
    id: string;
    name: string;
    type: WorkoutType;
    ownerId: string | null;
    movements: {
      poolExerciseId: string;
      reps: number | null;
      position: number;
      poolExercise: { name: string } | null;
    }[];
  }[];

  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type,
    ownerId: w.ownerId,
    movements: w.movements.map((m) => ({
      poolExerciseId: m.poolExerciseId,
      name: m.poolExercise?.name ?? "—",
      reps: m.reps,
      position: m.position,
    })),
  }));
}
