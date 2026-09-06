import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { createPersonalWorkoutCore } from "@/lib/workouts/personal";
import type { WorkoutType } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["AMRAP", "FOR_TIME", "MAX_SETS", "FOR_REPS", "STATIONS", "TIMED_STATIONS", "PYRAMID", "TABATA"];

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("validation", "Expected a JSON body."); }
  const raw = (body ?? {}) as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name : "";
  const type = typeof raw.type === "string" && TYPES.includes(raw.type) ? raw.type : null;
  if (!type) return apiError("validation", "Pick a workout type.");
  const capSec = typeof raw.capSec === "number" ? raw.capSec : null;
  const notes = typeof raw.notes === "string" ? raw.notes : null;
  const movements = Array.isArray(raw.movements)
    ? (raw.movements as Record<string, unknown>[]).map((m) => ({
        poolExerciseId: typeof m.poolExerciseId === "string" ? m.poolExerciseId : "",
        reps: typeof m.reps === "number" ? m.reps : null,
        distance: typeof m.distance === "number" ? m.distance : null,
        weight: typeof m.weight === "number" ? m.weight : null,
      }))
    : [];

  const res = await createPersonalWorkoutCore(authed.device.person.id, {
    name, type: type as WorkoutType, capSec, notes, movements,
  });
  if (res.error) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
