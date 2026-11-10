import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setWarmupDone } from "@/lib/workouts/cardio-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A Warm-up (or Mobility, v0.659) plan done or not (v0.615). Body: { date, plannedWorkoutId, done, completedOn? }.
 *  The whole answer each time, so safe to replay. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  const id = typeof b?.plannedWorkoutId === "string" ? b.plannedWorkoutId : "";
  if (!date || !id) return apiError("validation", "date and plannedWorkoutId are required.");
  const ok = await setWarmupDone(
    authed.device.person.id,
    date,
    id,
    b?.done !== false,
    typeof b?.completedOn === "string" ? b.completedOn : null,
  );
  if (!ok) return apiError("not_found", "No such warm-up.");
  return apiOk({ date, status: "saved" });
}
