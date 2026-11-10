import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setWarmupForSport } from "@/lib/workouts/warmup-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A sport day's Warm-up (v0.662). Body: { date, forSport } — true warms up for
 *  the day's sport (its routine, that day only), false for the planned
 *  workout. The whole answer each time, so safe to replay. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  if (!date) return apiError("validation", "date is required.");
  await setWarmupForSport(authed.device.person.id, date, b?.forSport === true);
  return apiOk({ date, status: "saved" });
}
