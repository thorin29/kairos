import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addPlannedHiitCore } from "@/lib/workouts/plan-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add a named HIIT/CrossFit workout to a day. Body: { day, hiitWorkoutId }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { day?: number; hiitWorkoutId?: string } | null;
  const day = typeof b?.day === "number" ? b.day : NaN;
  if (!Number.isInteger(day) || day < 0 || day > 6) return apiError("validation", "day must be 0..6.");
  if (!b?.hiitWorkoutId) return apiError("validation", "hiitWorkoutId required.");
  const r = await addPlannedHiitCore(authed.device.person.id, day, b.hiitWorkoutId);
  if (r === "not_found") return apiError("not_found", "No such workout.");
  return apiOk({ status: "ok" });
}
