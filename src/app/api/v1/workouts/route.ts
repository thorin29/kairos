import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadTodayExercises } from "@/lib/queries/workout-log";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The day's scheduled exercises to log (weight × reps), for this person.
 *  `loggable` is false when nothing per-exercise is scheduled — the client then
 *  falls back to the day-level "worked out / rest" actions. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const date = req.nextUrl.searchParams.get("date") ?? todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError("validation", "date must be YYYY-MM-DD.");
  }

  const exercises = await loadTodayExercises(authed.device.person.id, date);
  return apiOk({ date, loggable: exercises.length > 0, exercises });
}
