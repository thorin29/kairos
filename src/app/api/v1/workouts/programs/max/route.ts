import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setTrainingMax } from "@/lib/workouts/program-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set one lift's training max. Body: { poolExerciseId, weight } (0 clears it). */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { poolExerciseId?: unknown; weight?: unknown } | null;
  const id = typeof b?.poolExerciseId === "string" ? b.poolExerciseId : "";
  const w = typeof b?.weight === "number" && Number.isFinite(b.weight) ? b.weight : -1;
  if (!id || w < 0 || w >= 2000) return apiError("validation", "poolExerciseId and a weight are required.");
  await setTrainingMax(authed.device.person.id, id, w);
  return apiOk({ status: "ok" });
}
