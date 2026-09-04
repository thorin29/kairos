import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadWeeklyActivity } from "@/lib/queries/weekly-activity";
import { todayISO, weekDays } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** This week's non-weights workouts, grouped (label, count, detail). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const data = await loadWeeklyActivity(authed.device.person.id, weekDays(todayISO()));
  return apiOk({ items: data });
}
