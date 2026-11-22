import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setWorkoutTimeFor, workoutTimeFor } from "@/lib/workouts/workout-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One day's workout time (v0.744): `{ date, time }`, time "HH:MM" or minutes
 *  from midnight, or null to go back to the weekday's usual time. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { date?: unknown; time?: unknown } | null;
  const date = typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  if (!date) return apiError("validation", "date must be YYYY-MM-DD");
  const me = authed.device.person.id;
  await setWorkoutTimeFor(me, date, b?.time ?? null);
  return apiOk(await workoutTimeFor(me, date));
}
