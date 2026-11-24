import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { answerToday, backpackToday, finishTrip, lastTrip, startTrip } from "@/lib/workouts/backpacking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Today on a backpacking trip (v0.778): { today: { date, day, of, status,
 * miles, eventId, title } | null, lastTrip: { from, to, days, miles, minutes, gainFt, lossFt }
 * | null } (v0.779: the latest trip finished in the last 14 days).
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const userId = authed.device.person.id;
  return apiOk({ today: await backpackToday(userId), lastTrip: await lastTrip(userId) });
}

/**
 * { hiking: true|false } answers "Hiking today?"; { start: true, until:
 * "YYYY-MM-DD" } starts a trip from the app (makes the Backpacking event
 * unless today already has one); { finish: true } ends the trip today
 * (v0.787: cuts a longer single trip event to today). Returns { today }.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const userId = authed.device.person.id;
  const b = (await req.json().catch(() => null)) as { hiking?: unknown; start?: unknown; until?: unknown; finish?: unknown } | null;
  if (b?.finish === true) {
    await finishTrip(userId);
  } else if (b?.start === true) {
    if (!(await startTrip(userId, typeof b.until === "string" ? b.until : ""))) {
      return apiError("validation", "Pick the day you'll be back, within 30 days.");
    }
  } else if (typeof b?.hiking === "boolean") {
    await answerToday(userId, b.hiking);
  } else {
    return apiError("validation", "Send hiking, start or finish.");
  }
  return apiOk({ today: await backpackToday(userId), lastTrip: await lastTrip(userId) });
}
