import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addPlannedFromPoolCore } from "@/lib/workouts/plan-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add a structured pool workout to a day. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as {
    day?: number;
    category?: string;
    muscleGroup?: string | null;
    exercises?: { poolExerciseId: string; tracked?: boolean; metric?: string | null }[];
  } | null;
  const day = typeof b?.day === "number" ? b.day : NaN;
  if (!Number.isInteger(day) || day < 0 || day > 6) return apiError("validation", "day must be 0..6.");
  if (!b?.category) return apiError("validation", "category required.");
  await addPlannedFromPoolCore(authed.device.person.id, day, {
    category: b.category,
    muscleGroup: b.muscleGroup ?? null,
    exercises: (b.exercises ?? []).map((e) => ({
      poolExerciseId: e.poolExerciseId,
      tracked: e.tracked !== false,
      metric: e.metric ?? null,
    })),
  });
  return apiOk({ status: "ok" });
}
