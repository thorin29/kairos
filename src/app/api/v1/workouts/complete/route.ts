import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { bodyDate } from "@/lib/api/day";
import { setWorkedOut } from "@/lib/workouts/mark";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "I worked out" for a day (default today), no set-by-set detail. Idempotent.
 *  Detailed logging (exercises, weights, reps) is a later increment. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const date = await bodyDate(req, todayISO());
  if (date === null) return apiError("validation", "date must be YYYY-MM-DD.");

  await setWorkedOut(authed.device.person.id, date, true);
  return apiOk({ date, status: "worked" });
}
