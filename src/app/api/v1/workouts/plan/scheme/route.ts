import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setPlannedSchemeCore } from "@/lib/workouts/plan-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A planned movement's set structure (v0.615). Body: { plannedWorkoutId,
 *  poolExerciseId, scheme: "" | "same:3x5" | "range:3x8-12" | "wave" … }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const pw = typeof b?.plannedWorkoutId === "string" ? b.plannedWorkoutId : "";
  const pe = typeof b?.poolExerciseId === "string" ? b.poolExerciseId : "";
  if (!pw || !pe) return apiError("validation", "plannedWorkoutId and poolExerciseId are required.");
  const r = await setPlannedSchemeCore(authed.device.person.id, pw, pe, typeof b?.scheme === "string" ? b.scheme : "");
  if (r === "not_found") return apiError("not_found", "No such planned movement.");
  return apiOk({ status: "ok" });
}
