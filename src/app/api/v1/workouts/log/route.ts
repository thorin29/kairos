import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { logWorkoutSession, type WorkoutLogEntry } from "@/lib/workouts/mark";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

/** Log weight × reps for the day's scheduled exercises and complete the workout.
 *  Only the caller's own exercises are accepted; unknown ids are ignored. */
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

  const entriesIn = Array.isArray(raw?.entries) ? raw.entries : [];
  const owned = new Set(
    (
      await prisma.exercise.findMany({
        where: { userId: authed.device.person.id },
        select: { id: true },
      })
    ).map((e) => e.id),
  );

  const entries: WorkoutLogEntry[] = entriesIn
    .filter(
      (e): e is Record<string, unknown> =>
        !!e &&
        typeof e === "object" &&
        typeof (e as Record<string, unknown>).exerciseId === "string" &&
        owned.has((e as Record<string, unknown>).exerciseId as string),
    )
    .map((e) => ({
      exerciseId: e.exerciseId as string,
      weight: num(e.weight),
      reps: num(e.reps),
    }));

  const notes = typeof raw?.notes === "string" ? raw.notes : undefined;
  await logWorkoutSession(authed.device.person.id, date, entries, { notes });
  return apiOk({ date, status: "worked" });
}
