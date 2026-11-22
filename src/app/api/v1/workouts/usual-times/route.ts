import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setUsualWorkoutTimes, usualWorkoutTimes } from "@/lib/workouts/workout-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Your usual workout time per weekday (v0.744): `{ times }`, Sunday first,
 *  each minutes from midnight or null. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ times: await usualWorkoutTimes(authed.device.person.id) });
}

/** `{ times }`: seven "HH:MM", minutes or nulls. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { times?: unknown } | null;
  return apiOk({ times: await setUsualWorkoutTimes(authed.device.person.id, b?.times) });
}
