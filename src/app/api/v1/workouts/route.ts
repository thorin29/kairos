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
import { dayHeadline, daySections, type DayWorkoutIn } from "@/lib/workouts/blocks";
import type { Metric, MuscleGroup, WorkoutCategory } from "@/lib/workouts/catalog";
import { dayOfWeek, todayISO } from "@/lib/dates";
import { orderForDay } from "@/lib/workouts/day-order";
import { cardioDay, simplePlansFor } from "@/lib/workouts/cardio-run";
import { conditioningFor } from "@/lib/workouts/conditioning-run";
import { benchmarkFor, conditioningOnDay, pickPlansFor } from "@/lib/workouts/wod-run";
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
  const order = await orderForDay(userId, dayOfWeek(date));
  const overdue = date === today ? await loadOverdueWorkoutDays(userId, date) : [];

  // Every-set logging (v0.608): each movement carries its day's sets in a few
  // words and its last time, and the day its title and week strip. All
  // additive, so an older app reads exactly what it did before.
  let dayState: Awaited<ReturnType<typeof loadDayLogState>> | null = null;
  const withSets = async (dayISO: string, list: NonNullable<TodayPlanned>[]) => {
    const st = await loadDayLogState(userId, dayISO, list);
    if (dayISO === date) dayState = st;
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
  const program = await programInfoFor(userId, date);
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
    // The program's name on a program day, else the kinds of work (v0.625).
    title: program?.name ?? dayHeadline(daySections(dayWorkouts.map(asDayWorkout), order)),
    strip: { today, days: strip.days, overdue: strip.overdue },
    // The program and its week on this day (v0.611); null without one.
    program,
    // The day's suggestion card and a lighter day, if chosen (v0.612).
    suggestion: await daySuggestionFor(userId, date),
    light: await dayLightFactor(userId, date),
    // v0.615: the person's section order for this weekday; the day's Warm-up
    // and Cardio plans (no movements, so not in `workouts`); and the day's
    // cardio, Concept2 rows included, each with how it felt.
    order,
    simple: await simplePlansFor(userId, date),
    cardio: await cardioDay(userId, date),
    // v0.616: the day's planned conditioning workouts, with what the timer
    // needs and the results to beat.
    conditioning: await conditioningFor(userId, date),
    // v0.617: Conditioning plans picked on the day (done by any conditioning
    // that day, with what was logged) and the monthly benchmark (OFFER or
    // SUGGEST, or null). Each conditioning plan also carries `about`,
    // `scaled` and the person's starting `version`.
    picks: await pickPlansFor(userId, date),
    // v0.619: every conditioning result that day, for one-offs added to it.
    conditioningDone: await conditioningOnDay(userId, date),
    benchmark: await benchmarkFor(userId, date),
    // v0.623: what was logged that day outside its plans (an older plan, a
    // one-off), so a past day shows what was done; and whether anything was.
    loggedOther: (dayState as Awaited<ReturnType<typeof loadDayLogState>> | null)?.loggedOther ?? [],
    loggedAny: (dayState as Awaited<ReturnType<typeof loadDayLogState>> | null)?.loggedAny ?? false,
    // v0.624: the day was marked a rest day.
    rested: (dayState as Awaited<ReturnType<typeof loadDayLogState>> | null)?.rested ?? false,
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
