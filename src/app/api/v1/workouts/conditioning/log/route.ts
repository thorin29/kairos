import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { cleanBuilt } from "@/lib/workouts/finisher";
import { cleanVersion, logBuiltConditioning, logNamedConditioning } from "@/lib/workouts/wod-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Log a conditioning result (v0.617). Body: { date, value, version?: RX|
 * SCALED, completedOn?, and either hiitWorkoutId (a named workout, planned or
 * picked) or built (a Build one workout) }. One result per workout per day:
 * an earlier one under the same name that day is replaced. `value` is rounds,
 * reps or minutes, or seconds for a time.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = typeof b?.date === "string" && ISO.test(b.date) ? b.date : null;
  if (!date) return apiError("validation", "date must be YYYY-MM-DD.");
  const value = typeof b?.value === "number" && Number.isFinite(b.value) && b.value > 0 ? b.value : null;
  if (value == null) return apiError("validation", "value must be a positive number.");
  const userId = authed.device.person.id;
  const version = cleanVersion(b?.version);
  const completedOnISO = typeof b?.completedOn === "string" && ISO.test(b.completedOn) ? b.completedOn : null;

  let ok = false;
  if (typeof b?.hiitWorkoutId === "string" && b.hiitWorkoutId) {
    ok = await logNamedConditioning({ userId, dateISO: date, hiitWorkoutId: b.hiitWorkoutId, value, version, replace: true, completedOnISO });
  } else {
    const built = cleanBuilt(b?.built);
    if (!built) return apiError("validation", "Send hiitWorkoutId or built.");
    ok = await logBuiltConditioning({ userId, dateISO: date, built, value, version, replace: true, completedOnISO });
  }
  if (!ok) return apiError("validation", "That workout can't be logged.");
  return apiOk({ date, status: "logged" });
}
