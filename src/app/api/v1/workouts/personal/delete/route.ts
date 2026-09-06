import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { deletePersonalWorkoutCore } from "@/lib/workouts/personal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: unknown;
  try { body = await req.json(); } catch { return apiError("validation", "Expected a JSON body."); }
  const raw = (body ?? {}) as Record<string, unknown>;
  const workoutId = typeof raw.workoutId === "string" ? raw.workoutId : "";
  if (!workoutId) return apiError("validation", "workoutId is required.");
  await deletePersonalWorkoutCore(authed.device.person.id, workoutId);
  return apiOk({ status: "ok" });
}
