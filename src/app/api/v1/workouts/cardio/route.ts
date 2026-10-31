import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { cardioDay, logCardio } from "@/lib/workouts/cardio-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Log one cardio entry for a day (v0.615). Body: { date, activity: row|run|
 * ruck|jump_rope|bike|other, meters?, distance?, seconds?, load?, completedOn? }.
 * Returns the day's cardio.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = typeof b?.date === "string" && ISO.test(b.date) ? b.date : null;
  if (!date) return apiError("validation", "date must be YYYY-MM-DD.");
  const userId = authed.device.person.id;
  const id = await logCardio(userId, date, {
    activity: typeof b?.activity === "string" ? b.activity : "",
    meters: n(b?.meters),
    distance: n(b?.distance),
    seconds: n(b?.seconds),
    load: n(b?.load),
    completedOnISO: typeof b?.completedOn === "string" ? b.completedOn : null,
  });
  if (!id) return apiError("validation", "Pick an activity and enter a time or a distance.");
  return apiOk({ date, cardio: await cardioDay(userId, date) });
}
