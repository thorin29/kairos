import "server-only";
import { prisma } from "@/lib/prisma";
import { dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import {
  CATEGORY_LABEL,
  LINE_COLORS,
  UNIT_SYSTEM_KEY,
  type Implement,
  type Metric,
  type MuscleGroup,
  type UnitSystem,
  type WorkoutCategory,
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
};

export type PlanWorkout = {
  id: string;
  name: string;
  category: WorkoutCategory | null;
  muscleGroup: MuscleGroup | null;
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

  const [people, unitRaw] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true, color: true, avatarPath: true },
    }),
    getSetting(UNIT_SYSTEM_KEY),
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
          exercise: {
            userId: person.id,
            category: "WEIGHTS",
            tracked: true,
            isActive: true,
          },
        },
        select: {
          exerciseId: true,
          weight: true,
          session: { select: { date: true } },
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
      exerciseId: string; weight: number | null; session: { date: Date };
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

    // Graph series: max weight per exercise per day, in date order.
    const nameById = new Map(exRows.map((e) => [e.id, e.name]));
    const unitById = new Map(exRows.map((e) => [e.id, e.unit]));
    const perExerciseDay = new Map<string, Map<string, number>>();
    for (const set of wSets) {
      if (set.weight == null) continue;
      const d = fromDateColumn(set.session.date);
      const m = perExerciseDay.get(set.exerciseId) ?? new Map<string, number>();
      m.set(d, Math.max(m.get(d) ?? 0, set.weight));
      perExerciseDay.set(set.exerciseId, m);
    }

    const trackedWeights = defs.filter((d) => d.category === "WEIGHTS" && d.tracked);
    const weightSeries: GraphSeries[] = trackedWeights
      .map((d, i) => {
        const days = perExerciseDay.get(d.id);
        const points = days
          ? [...days.entries()]
              .map(([date, value]) => ({ date, value }))
              .sort((a, b) => (a.date < b.date ? -1 : 1))
          : [];
        return {
          exerciseId: d.id,
          name: nameById.get(d.id) ?? d.name,
          unit: unitById.get(d.id) ?? d.unit,
          color: LINE_COLORS[i % LINE_COLORS.length],
          points,
        };
      })
      .filter((s) => s.points.length > 0);

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
          exercises: w.exercises.map((e) => ({
            id: e.id,
            poolExerciseId: e.poolExerciseId,
            name: e.poolExercise?.name ?? "—",
            muscleGroup: e.poolExercise?.muscleGroup ?? null,
            tracked: e.tracked,
            metric: e.metric,
          })),
        })),
    }));
    const todayPlanned = plan[dow]?.workouts ?? [];

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

export type WorkoutAdminRow = {
  id: string;
  name: string;
  color: string;
  exerciseCount: number;
  trackedCount: number;
};

export async function loadWorkoutAdmin(): Promise<{
  unitSystem: UnitSystem;
  people: WorkoutAdminRow[];
}> {
  const [unitSystem, users] = await Promise.all([
    loadWorkoutUnitSystem(),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        workoutExercises: { where: { isActive: true }, select: { tracked: true } },
      },
    }),
  ]);

  return {
    unitSystem,
    people: users.map((u) => ({
      id: u.id,
      name: u.displayName ?? u.name,
      color: u.color,
      exerciseCount: u.workoutExercises.length,
      trackedCount: u.workoutExercises.filter((e) => e.tracked).length,
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
};

export async function loadExercisePool(): Promise<PoolEntry[]> {
  const rows = await prisma.poolExercise.findMany({
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
  });
  return rows as unknown as PoolEntry[];
}
