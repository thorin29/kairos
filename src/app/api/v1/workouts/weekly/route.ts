import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadWeeklyTraining } from "@/lib/queries/workout-log";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The last 12 weeks of training (days, sets, minutes) and weeks trained in
 *  a row (v0.610). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk(await loadWeeklyTraining(authed.device.person.id, todayISO()));
}
