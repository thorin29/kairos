import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { logPlannedWorkout, type PlannedLogEntry } from "@/lib/workouts/mark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METRICS = new Set(["WEIGHT", "REPS", "DISTANCE", "METERS", "DURATION"]);

/** Log today's planned workout — one value per movement — and complete it. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const raw = body as Record<string, unknown> | null;
  const date =
    typeof raw?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
      ? raw.date
      : null;
  if (!date) return apiError("validation", "date must be YYYY-MM-DD.");
  const plannedWorkoutId =
    typeof raw?.plannedWorkoutId === "string" ? raw.plannedWorkoutId : null;
  if (!plannedWorkoutId) {
    return apiError("validation", "plannedWorkoutId is required.");
  }

  const entriesIn = Array.isArray(raw?.entries) ? raw.entries : [];
  const entries: PlannedLogEntry[] = entriesIn
    .filter(
      (e): e is Record<string, unknown> =>
        !!e &&
        typeof e === "object" &&
        typeof (e as Record<string, unknown>).poolExerciseId === "string" &&
        typeof (e as Record<string, unknown>).metric === "string" &&
        METRICS.has((e as Record<string, unknown>).metric as string) &&
        typeof (e as Record<string, unknown>).value === "number" &&
        Number.isFinite((e as Record<string, unknown>).value as number),
    )
    .map((e) => ({
      poolExerciseId: e.poolExerciseId as string,
      metric: e.metric as string,
      value: e.value as number,
      unit: typeof e.unit === "string" ? (e.unit as string) : "",
    }));

  await logPlannedWorkout(authed.device.person.id, date, plannedWorkoutId, entries);
  return apiOk({ date, status: "worked" });
}
