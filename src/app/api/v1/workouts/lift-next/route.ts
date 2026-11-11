import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { liftNext } from "@/lib/workouts/lift-next-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A lift's next planned top set (v0.670): `?movement=<poolExerciseId>` →
 *  { next: { date, weight, reps } | null }. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const movement = req.nextUrl.searchParams.get("movement")?.slice(0, 60);
  if (!movement) return apiError("validation", "movement is required.");
  return apiOk({ next: await liftNext(authed.device.person.id, movement) });
}
