import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { todayISO } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { endWorkoutPause, isPauseReason, okPauseRange, startWorkoutPause, workoutPausesFor } from "@/lib/workouts/pause-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The person's workout pauses now and ahead (v0.678), household ones too. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ pauses: await workoutPausesFor(authed.device.person.id, todayISO()) });
}

/**
 * Add a pause: { reason: "SICK"|"HURT"|"VACATION"|"OTHER", from?: "YYYY-MM-DD"
 * (default today; up to a year ahead), until: "YYYY-MM-DD" } (at most 180
 * days; the person's own pauses it overlaps give way). Or end one now, or
 * remove one ahead: { end: "<pause id>" }. Returns the pauses now and ahead.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = authed.device.person.id;
  const today = todayISO();
  if (typeof b?.end === "string") {
    await endWorkoutPause(userId, b.end, today);
  } else {
    const range = okPauseRange(typeof b?.from === "string" ? b.from : today, b?.until, today);
    if (!isPauseReason(b?.reason) || !range) return apiError("validation", "reason, and until on or after from (YYYY-MM-DD, from today on), are required.");
    await startWorkoutPause(userId, b.reason, range.from, range.to);
  }
  await generateWorkoutTasks();
  return apiOk({ pauses: await workoutPausesFor(userId, today) });
}
