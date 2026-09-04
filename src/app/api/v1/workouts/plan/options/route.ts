import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadPlanOptions } from "@/lib/queries/workout-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Categories, muscle groups, exercise pool, and named workouts for the picker. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk(await loadPlanOptions(authed.device.person.id));
}
