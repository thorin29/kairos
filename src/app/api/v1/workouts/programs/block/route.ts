import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { nextBlock } from "@/lib/workouts/program-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** End of a block: start the next. Body: { raise: bool } raises the training
 *  maxes a step; or { raises: { poolExerciseId: amount } } (v0.620), each
 *  lift by its own amount, 0 holding it. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { raise?: unknown; raises?: unknown } | null;
  if (b == null) return apiError("validation", "Expected a JSON body.");
  let raises: Record<string, number> | undefined;
  if (b.raises && typeof b.raises === "object") {
    raises = {};
    for (const [k, v] of Object.entries(b.raises as Record<string, unknown>)) if (typeof v === "number") raises[k] = v;
  }
  await nextBlock(authed.device.person.id, b.raise === true, raises);
  return apiOk({ status: "ok" });
}
