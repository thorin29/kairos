import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadTodayPlannedWorkout } from "@/lib/queries/workout-log";
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

  const planned = await loadTodayPlannedWorkout(authed.device.person.id, date);
  return apiOk({
    date,
    loggable: planned != null,
    plannedWorkoutId: planned?.plannedWorkoutId ?? null,
    name: planned?.name ?? null,
    exercises: planned?.exercises ?? [],
  });
}
