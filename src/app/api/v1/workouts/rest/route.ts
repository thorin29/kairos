import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { bodyDate } from "@/lib/api/day";
import { setRestDay } from "@/lib/workouts/mark";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mark a day (default today) a rest day: excuses the workout task (SKIPPED).
 *  Idempotent. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const date = await bodyDate(req, todayISO());
  if (date === null) return apiError("validation", "date must be YYYY-MM-DD.");

  await setRestDay(authed.device.person.id, date);
  return apiOk({ date, status: "rest" });
}
