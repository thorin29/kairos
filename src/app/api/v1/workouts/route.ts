import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadTodayPlannedWorkout, loadTodayPlannedWorkouts, loadOverdueWorkoutDays } from "@/lib/queries/workout-log";
import { todayISO } from "@/lib/dates";

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

  const workouts = await loadTodayPlannedWorkouts(authed.device.person.id, date);
  const overdue = date === todayISO()
    ? await loadOverdueWorkoutDays(authed.device.person.id, date)
    : [];
  const first = workouts[0] ?? null;
  return apiOk({
    date,
    loggable: workouts.length > 0,
    // All of the day's planned workouts (Core, Arms, ...). Older clients that
    // read the single fields still get the first one.
    workouts,
    // Past days whose workout is still pending, each with its own plan.
    overdue,
    plannedWorkoutId: first?.plannedWorkoutId ?? null,
    name: first?.name ?? null,
    exercises: first?.exercises ?? [],
  });
}
