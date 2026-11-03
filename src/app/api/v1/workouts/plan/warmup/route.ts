import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setPlanWarmup } from "@/lib/workouts/warmup-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A Warm-up plan entry's routine (v0.622). Body: { plannedWorkoutId,
 *  warmup: "lib:<key>" | routine id | null }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { plannedWorkoutId?: unknown; warmup?: unknown } | null;
  if (typeof b?.plannedWorkoutId !== "string" || !b.plannedWorkoutId) return apiError("validation", "plannedWorkoutId is required.");
  const ok = await setPlanWarmup(
    authed.device.person.id,
    b.plannedWorkoutId,
    typeof b.warmup === "string" && b.warmup ? b.warmup : null,
  );
  if (!ok) return apiError("validation", "That warm-up isn't available.");
  return apiOk({ status: "ok" });
}
