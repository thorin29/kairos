import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { todayISO } from "@/lib/dates";
import { conditioningChoices } from "@/lib/workouts/wod-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pick one (v0.617): every workout the person can do (approved and their
 * own), with how long, what it needs, Rx and Scaled, their last result and
 * the household best; their starting version; the equipment on hand.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const date = req.nextUrl.searchParams.get("date") ?? todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError("validation", "date must be YYYY-MM-DD.");
  return apiOk({ date, ...(await conditioningChoices(authed.device.person.id, date)) });
}
