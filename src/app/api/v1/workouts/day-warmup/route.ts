import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setDayWarmupSwap } from "@/lib/workouts/warmup-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A Warm-up plan entry's routine for one day only (v0.711). Body: { date,
 *  plannedWorkoutId, warmup: "lib:<key>" | routine id | null }; null switches
 *  to a plain check. The plan and any rotation are left as they are. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  if (!date) return apiError("validation", "date is required.");
  if (typeof b?.plannedWorkoutId !== "string" || !b.plannedWorkoutId) return apiError("validation", "plannedWorkoutId is required.");
  const ok = await setDayWarmupSwap(
    authed.device.person.id,
    date,
    b.plannedWorkoutId,
    typeof b.warmup === "string" && b.warmup ? b.warmup : null,
  );
  if (!ok) return apiError("validation", "That warm-up isn't available.");
  return apiOk({ date, status: "saved" });
}
