import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { answerToday, backpackToday, startTrip } from "@/lib/workouts/backpacking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Today on a backpacking trip (v0.778): { today: { date, day, of, status, miles } | null }. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ today: await backpackToday(authed.device.person.id) });
}

/**
 * { hiking: true|false } answers "Hiking today?"; { start: true, until:
 * "YYYY-MM-DD" } starts a trip from the app (makes the Backpacking event
 * unless today already has one). Returns { today }.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const userId = authed.device.person.id;
  const b = (await req.json().catch(() => null)) as { hiking?: unknown; start?: unknown; until?: unknown } | null;
  if (b?.start === true) {
    if (!(await startTrip(userId, typeof b.until === "string" ? b.until : ""))) {
      return apiError("validation", "Pick the day you'll be back, within 30 days.");
    }
  } else if (typeof b?.hiking === "boolean") {
    await answerToday(userId, b.hiking);
  } else {
    return apiError("validation", "Send hiking or start.");
  }
  return apiOk({ today: await backpackToday(userId) });
}
