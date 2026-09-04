import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadWorkoutProgress } from "@/lib/queries/workout-log";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** This person's workout history + per-movement weight progress (graph series). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const data = await loadWorkoutProgress(authed.device.person.id, todayISO());
  return apiOk(data);
}
