import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadPlan } from "@/lib/queries/workout-log";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The caller's weekly plan (7 days). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const days = await loadPlan(authed.device.person.id);
  const weeklyStart = (await getSetting(`weeklyStart:${authed.device.person.id}`)) ?? "";
  const weeklyActive = (await getSetting(`weeklyActive:${authed.device.person.id}`)) !== "0";
  return apiOk({ days, weeklyStart, weeklyActive });
}
