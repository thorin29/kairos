import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setCoreDay } from "@/lib/workouts/core-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A Core day (v0.637). Body: { day, rotation, test } makes one on that day;
 *  { plannedWorkoutId, rotation, test } changes one. `rotation`: core workout
 *  ids in order; `test`: the monthly plank test. → { status: "ok", id }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return apiError("validation", "Expected a JSON body.");
  const r = await setCoreDay(authed.device.person.id, {
    plannedWorkoutId: typeof b.plannedWorkoutId === "string" ? b.plannedWorkoutId : null,
    day: typeof b.day === "number" ? b.day : null,
    rotation: b.rotation,
    test: b.test,
  });
  return r.ok ? apiOk({ status: "ok", id: r.id }) : apiError("validation", r.error);
}
