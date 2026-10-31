import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import {
  loadTodayPlannedWorkouts,
  loadOverdueWorkoutDays,
  loadDayLogState,
  loadWeekStrip,
  type TodayPlanned,
} from "@/lib/queries/workout-log";
import { daySections, dayTitle, type DayWorkoutIn } from "@/lib/workouts/blocks";
import type { Metric, MuscleGroup, WorkoutCategory } from "@/lib/workouts/catalog";
import { todayISO } from "@/lib/dates";
import { programInfoFor } from "@/lib/workouts/program-run";
import { dayLightFactor, daySuggestionFor } from "@/lib/workouts/suggest-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Today's planned workout (e.g. "Legs") with its movements to log. `loggable`
 *  is false when nothing is planned today — the client falls back to the
 *  day-level worked-out/rest actions. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const date = req.nextUrl.searchParams.get("date") ?? todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError("validation", "date must be YYYY-MM-DD.");
  }

  const userId = authed.device.person.id;
  const today = todayISO();
  const workouts = await loadTodayPlannedWorkouts(userId, date);
  const overdue = date === today ? await loadOverdueWorkoutDays(userId, date) : [];

  // Every-set logging (v0.608): each movement carries its day's sets in a few
  // words and its last time, and the day its title and week strip. All
  // additive, so an older app reads exactly what it did before.
  const withSets = async (dayISO: string, list: NonNullable<TodayPlanned>[]) => {
    const st = await loadDayLogState(userId, dayISO, list);
    return list.map((w) => ({
      ...w,
      exercises: w.exercises.map((e) => {
        const m = e.poolExerciseId ? st.movements[e.poolExerciseId] : undefined;
        return m ? { ...e, setCount: m.setCount, summary: m.summary, last: m.last } : e;
      }),
    }));
  };
  const [dayWorkouts, overdueDays, strip] = await Promise.all([
    withSets(date, workouts),
    Promise.all(overdue.map(async (o) => ({ ...o, workouts: await withSets(o.date, o.workouts) }))),
    loadWeekStrip(userId, today),
  ]);
  const first = dayWorkouts[0] ?? null;
  return apiOk({
    date,
    loggable: dayWorkouts.length > 0,
    // All of the day's planned workouts (Core, Arms, ...). Older clients that
    // read the single fields still get the first one.
    workouts: dayWorkouts,
    // Past days whose workout is still pending, each with its own plan.
    overdue: overdueDays,
    plannedWorkoutId: first?.plannedWorkoutId ?? null,
    name: first?.name ?? null,
    exercises: first?.exercises ?? [],
    title: dayTitle(daySections(dayWorkouts.map(asDayWorkout))),
    strip: { today, days: strip.days, overdue: strip.overdue },
    // The program and its week on this day (v0.611); null without one.
    program: await programInfoFor(userId, date),
    // The day's suggestion card and a lighter day, if chosen (v0.612).
    suggestion: await daySuggestionFor(userId, date),
    light: await dayLightFactor(userId, date),
  });
}

/** The phone's plan shape, read the way the day page lays it out. A one-result
 *  plan (HIIT) carries a single movement with no id. */
function asDayWorkout(w: NonNullable<TodayPlanned>): DayWorkoutIn {
  return {
    id: w.plannedWorkoutId,
    name: w.name,
    category: (w.category ?? null) as WorkoutCategory | null,
    muscleGroup: (w.muscleGroup ?? null) as MuscleGroup | null,
    isRest: false,
    hasHiit: w.exercises.some((e) => !e.poolExerciseId),
    movements: w.exercises
      .filter((e) => e.poolExerciseId)
      .map((e) => ({
        poolExerciseId: e.poolExerciseId,
        name: e.name,
        tracked: e.tracked !== false,
        metric: e.metric as Metric,
      })),
  };
}
