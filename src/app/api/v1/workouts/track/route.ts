import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { cardioDay } from "@/lib/workouts/cardio-run";
import { saveTrackedWorkout } from "@/lib/workouts/tracked";
import { parseTrack } from "@/lib/workouts/tracked-shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save a walk, run, ruck or hike tracked with the phone's GPS (v0.777). Body:
 * { clientId, activity: walk|run|ruck|hike, startAt, endAt (ISO), movingSec,
 * distanceM, load? (ruck), path: [[lat, lng, ms], …] }. Logged as its own
 * cardio session; a resend with the same clientId changes nothing. Returns
 * { sessionId, date, cardio }.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const t = parseTrack((await req.json().catch(() => null)) as Record<string, unknown> | null);
  if (!t) return apiError("validation", "Send an activity, start and end times, a time and a distance.");
  const userId = authed.device.person.id;
  const saved = await saveTrackedWorkout(userId, t);
  if (!saved) return apiError("validation", "That workout couldn't be saved.");
  return apiOk({ ...saved, cardio: await cardioDay(userId, saved.date) });
}
