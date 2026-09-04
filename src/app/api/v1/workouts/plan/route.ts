import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadPlan } from "@/lib/queries/workout-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The caller's weekly plan (7 days). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const days = await loadPlan(authed.device.person.id);
  return apiOk({ days });
}
