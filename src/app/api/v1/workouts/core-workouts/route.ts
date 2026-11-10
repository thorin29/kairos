import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { coreWorkoutsFor, saveCoreWorkout } from "@/lib/workouts/core-run";
import { coreWorkoutView } from "@/lib/queries/workout-log";
import { rotationKindOf } from "@/lib/workouts/core-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Core workouts (v0.637): the library's ("lib:<key>") and the caller's own.
 *  → { workouts: [{ id, name, minutes, gear, mine, moves: [{ name, poolExerciseId, kind, sets, min, max, label }] }] } */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  // ?kind=arms for Arms days (v0.651), ?kind=iso for Isometric (v0.661); Core otherwise.
  const kind = rotationKindOf(req.nextUrl.searchParams.get("kind"));
  return apiOk({ workouts: (await coreWorkoutsFor(authed.device.person.id, kind)).map(coreWorkoutView) });
}

/** Save one's own core workout. Body: { id?, name, moves: [{ poolExerciseId, kind, sets, min, max }] }
 *  → { status: "ok", id }. `kind` is REPS, TIME (min/max in seconds) or WEIGHT. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return apiError("validation", "Expected a JSON body.");
  // A move's name comes from the pool; one is needed to pass the cleaner.
  const moves = Array.isArray(b.moves)
    ? b.moves.map((m) => (m && typeof m === "object" ? { name: "-", ...(m as object) } : m))
    : [];
  const r = await saveCoreWorkout(authed.device.person.id, {
    id: typeof b.id === "string" ? b.id : null,
    name: b.name,
    moves,
    kind: b.kind,
  });
  return r.ok ? apiOk({ status: "ok", id: r.id }) : apiError("validation", r.error);
}
