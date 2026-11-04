import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { deleteCoreWorkout } from "@/lib/workouts/core-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Delete one's own core workout (v0.637). Body: { id }. Core days drop it
 *  from their rotation. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof b?.id !== "string" || !b.id) return apiError("validation", "id is required.");
  await deleteCoreWorkout(authed.device.person.id, b.id);
  return apiOk({ status: "ok" });
}
