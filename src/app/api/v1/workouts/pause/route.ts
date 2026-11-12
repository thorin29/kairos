import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addDays, todayISO } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { endWorkoutPause, isPauseReason, startWorkoutPause, workoutPausesFor } from "@/lib/workouts/pause-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The person's workout pauses now and ahead (v0.678), household ones too. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ pauses: await workoutPausesFor(authed.device.person.id, todayISO()) });
}

/**
 * Start a pause from today: { reason: "SICK"|"HURT"|"OTHER", until: "YYYY-MM-DD" }
 * (up to 90 days; replaces the person's own pause running or ahead). Or end
 * one now: { end: "<pause id>" }. Returns the pauses now and ahead.
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
    const until = typeof b?.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.until) ? b.until : null;
    if (!isPauseReason(b?.reason) || !until) return apiError("validation", "reason and until (YYYY-MM-DD) are required.");
    await startWorkoutPause(userId, b.reason, today, until > addDays(today, 90) ? addDays(today, 90) : until);
  }
  await generateWorkoutTasks();
  return apiOk({ pauses: await workoutPausesFor(userId, today) });
}
