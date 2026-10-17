import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setMovementSkipped } from "@/lib/workouts/mark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Skip or un-skip one planned movement for a day. A skip counts as done for
 * that movement: the day's workout completes once every planned movement is
 * logged or skipped. An empty `poolExerciseId` skips a plan logged as a single
 * result (a named HIIT workout). Idempotent.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const raw = body as Record<string, unknown> | null;
  const date =
    typeof raw?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
      ? raw.date
      : null;
  if (!date) return apiError("validation", "date must be YYYY-MM-DD.");
  const plannedWorkoutId =
    typeof raw?.plannedWorkoutId === "string" && raw.plannedWorkoutId
      ? raw.plannedWorkoutId
      : null;
  if (!plannedWorkoutId) {
    return apiError("validation", "plannedWorkoutId is required.");
  }
  const poolExerciseId =
    typeof raw?.poolExerciseId === "string" ? raw.poolExerciseId : "";
  if (typeof raw?.skipped !== "boolean") {
    return apiError("validation", "skipped must be true or false.");
  }

  const ok = await setMovementSkipped(
    authed.device.person.id,
    date,
    plannedWorkoutId,
    poolExerciseId,
    raw.skipped,
  );
  if (!ok) return apiError("not_found", "No such planned workout.");
  return apiOk({ date, skipped: raw.skipped });
}
