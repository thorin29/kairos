import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { logCustomEntry } from "@/lib/workouts/mark";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METRICS = new Set(["WEIGHT", "REPS", "DISTANCE", "METERS", "DURATION"]);

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

/** Log an ad-hoc "different workout". */
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
      : todayISO();
  const metric = typeof raw?.metric === "string" ? raw.metric : "";
  if (!METRICS.has(metric)) return apiError("validation", "Invalid metric.");
  const value = num(raw?.value);
  if (value == null || value <= 0) {
    return apiError("validation", "A positive value is required.");
  }
  const poolExerciseId =
    typeof raw?.poolExerciseId === "string" ? raw.poolExerciseId : null;
  const category = typeof raw?.category === "string" ? raw.category : null;
  if (!poolExerciseId && !category) {
    return apiError("validation", "An exercise or category is required.");
  }

  await logCustomEntry(authed.device.person.id, date, {
    poolExerciseId,
    category,
    metric,
    value,
    unit: typeof raw?.unit === "string" ? raw.unit : "",
    load: num(raw?.load),
    notes: typeof raw?.notes === "string" ? raw.notes : undefined,
  });
  return apiOk({ date, status: "worked" });
}
