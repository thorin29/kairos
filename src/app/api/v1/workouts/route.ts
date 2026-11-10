import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import {
  loadTodayPlannedWorkouts,
  loadOverdueWorkoutDays,
  loadDayLogState,
  programDayTitle,
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
import { dayProgramInfo } from "@/lib/workouts/program-run";
import { dayLightFactor, daySuggestionFor } from "@/lib/workouts/suggest-run";
import { adjustView } from "@/lib/workouts/adjust-run";
import { sportDayView } from "@/lib/workouts/warmup-run";

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
  // What today's adjustment drops stays off the phone's day too (v0.658).
  const adjusted = await adjustView(userId, date);
  const gone = new Set(adjusted?.dropped.plans ?? []);
  const kept = <T extends { plannedWorkoutId: string }>(list: T[]) => list.filter((x) => !gone.has(x.plannedWorkoutId));
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
  const program = await dayProgramInfo(userId, date);
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
    // On a program day the program and its main lift, as on the home card
    // (v0.626), or on a past day what was logged in it ("5/3/1 · Legs",
    // v0.627); else the kinds of work (v0.625); else what was logged.
    title: (dayState as Awaited<ReturnType<typeof loadDayLogState>> | null)?.restPlanned
      ? "Rest day"
      : (dayState as Awaited<ReturnType<typeof loadDayLogState>> | null)?.programTitle ??
      ((program
        ? await programDayTitle(userId, date, program.name)
        : dayHeadline(daySections(dayWorkouts.map(asDayWorkout), order))) ||
        ((dayState as Awaited<ReturnType<typeof loadDayLogState>> | null)?.loggedTitle ?? "")),
    strip: { today, days: strip.days, overdue: strip.overdue },
    // The program and its week on this day (v0.611); null without one.
    program,
    // The day's suggestion card and a lighter day, if chosen (v0.612).
    suggestion: await daySuggestionFor(userId, date),
    light: await dayLightFactor(userId, date),
    // v0.658: today's adjustment — { mode, label, dropped } — or null.
    adjusted,
    // v0.662: a sport on the calendar — { label, forSport, routine } — or null.
    sportDay: await sportDayView(userId, date),
    // v0.615: the person's section order for this weekday; the day's Warm-up
    // and Cardio plans (no movements, so not in `workouts`); and the day's
    // cardio, Concept2 rows included, each with how it felt.
    order,
    simple: kept(await simplePlansFor(userId, date)),
    cardio: await cardioDay(userId, date),
    // v0.616: the day's planned conditioning workouts, with what the timer
    // needs and the results to beat.
    conditioning: kept(await conditioningFor(userId, date)),
    // v0.617: Conditioning plans picked on the day (done by any conditioning
    // that day, with what was logged) and the monthly benchmark (OFFER or
    // SUGGEST, or null). Each conditioning plan also carries `about`,
    // `scaled` and the person's starting `version`.
    picks: kept(await pickPlansFor(userId, date)),
    // v0.619: every conditioning result that day, for one-offs added to it.
    conditioningDone: await conditioningOnDay(userId, date),
    benchmark: await benchmarkFor(userId, date),
    // v0.623: what was logged that day outside its plans (an older plan, a
    // one-off), so a past day shows what was done; and whether anything was.
    loggedOther: (dayState as Awaited<ReturnType<typeof loadDayLogState>> | null)?.loggedOther ?? [],
    loggedAny: (dayState as Awaited<ReturnType<typeof loadDayLogState>> | null)?.loggedAny ?? false,
    // v0.624: the day was marked a rest day.
    rested: (dayState as Awaited<ReturnType<typeof loadDayLogState>> | null)?.rested ?? false,
    // v0.646: the plan makes this weekday a rest day; `loggedOther` then lists
    // rows and conditioning too.
    restPlanned: (dayState as Awaited<ReturnType<typeof loadDayLogState>> | null)?.restPlanned ?? false,
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
