import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { cleanBuilt } from "@/lib/workouts/finisher";
import { saveBuiltWorkout } from "@/lib/workouts/wod-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keep a Build one workout as the person's own (v0.617). Body: { built }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const built = cleanBuilt(b?.built);
  if (!built) return apiError("validation", "built is required.");
  const id = await saveBuiltWorkout(authed.device.person.id, built);
  if (!id) return apiError("validation", "Couldn't save that workout.");
  return apiOk({ hiitWorkoutId: id });
}
