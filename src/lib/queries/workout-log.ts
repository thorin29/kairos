import "server-only";
import { prisma } from "@/lib/prisma";
import { dayOfWeek, fromDateColumn, toDateColumn } from "@/lib/dates";

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
