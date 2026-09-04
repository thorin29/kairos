import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadBrowsableWorkouts } from "@/lib/queries/workout-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Named workouts to browse: shared library + this person's own. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const data = await loadBrowsableWorkouts(authed.device.person.id);
  return apiOk({ items: data });
}
