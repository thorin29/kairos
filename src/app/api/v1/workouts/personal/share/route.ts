import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { sharePersonalWorkoutCore } from "@/lib/workouts/personal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: unknown;
  try { body = await req.json(); } catch { return apiError("validation", "Expected a JSON body."); }
  const raw = (body ?? {}) as Record<string, unknown>;
  const workoutId = typeof raw.workoutId === "string" ? raw.workoutId : "";
  const targetUserId = typeof raw.targetUserId === "string" ? raw.targetUserId : "";
  if (!workoutId) return apiError("validation", "workoutId is required.");
  const res = await sharePersonalWorkoutCore(authed.device.person.id, workoutId, targetUserId);
  if (res.error) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
