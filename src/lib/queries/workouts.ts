import "server-only";
import { prisma } from "@/lib/prisma";
import { dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import {
  LINE_COLORS,
  UNIT_SYSTEM_KEY,
  type Implement,
  type Metric,
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

export type PersonWorkout = {
  user: { id: string; name: string; color: string; avatarPath: string | null };
  categories: WorkoutCategory[];
  exercises: ExerciseDef[];
  weightSeries: GraphSeries[];
  today: { scheduled: TodayExercise[]; workedOut: boolean };
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
    const [exercises, schedules, weightSets, task, todaySession] = await Promise.all([
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
      prisma.workoutSession.findFirst({
        where: { userId: person.id, date: today },
        select: { sets: { select: { exerciseId: true, weight: true, reps: true } } },
      }),
    ]);

    const exRows = exercises as unknown as {
      id: string; name: string; unit: string; implement: string | null;
      category: string; metric: string; tracked: boolean;
    }[];
    const wSets = weightSets as unknown as {
      exerciseId: string; weight: number | null; session: { date: Date };
    }[];
    const tSets = (todaySession?.sets ?? []) as unknown as {
      exerciseId: string; weight: number | null; reps: number | null;
    }[];

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

    const workedOut = task?.status === "COMPLETE";

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
      today: { scheduled, workedOut },
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
