import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadWorkoutPool } from "@/lib/queries/workout-log";
import { WORKOUT_TYPE_LABEL } from "@/lib/workouts/catalog";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the app needs to create or edit a personal workout: the workout
 *  types, the HIIT/CrossFit exercise pool (shared + this person's own), who they
 *  can share to, and this person's existing workouts (with full detail so the
 *  form can load one for editing without another round-trip). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const userId = authed.device.person.id;

  const [pool, people, mine, myExercises] = await Promise.all([
    loadWorkoutPool(userId),
    prisma.user.findMany({
      where: { isActive: true, id: { not: userId } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, displayName: true },
    }),
    prisma.hiitWorkout.findMany({
      where: { ownerId: userId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        capSec: true,
        notes: true,
        movements: {
          orderBy: { position: "asc" },
          select: { poolExerciseId: true, reps: true, distance: true, weight: true },
        },
      },
    }),
    prisma.poolExercise.findMany({
      where: { ownerId: userId, category: "HIIT" as never },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const types = Object.entries(WORKOUT_TYPE_LABEL as Record<string, string>).map(
    ([key, label]) => ({ key, label }),
  );

  // Exercises come from the HIIT/CrossFit pool only (shared + this person's own).
  const hiitMovements = pool.exercises.filter((e) => (e.category as string) === "HIIT");

  return apiOk({
    types,
    movements: hiitMovements.map((e) => ({ id: e.id, name: e.name })),
    myExercises: (myExercises as { id: string; name: string }[]).map((e) => ({ id: e.id, name: e.name })),
    people: people.map((p) => ({ id: p.id, name: p.displayName?.trim() || p.name })),
    myWorkouts: mine.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type as string,
      capSec: w.capSec,
      notes: w.notes,
      movements: w.movements.map((m) => ({
        poolExerciseId: m.poolExerciseId,
        reps: m.reps,
        distance: m.distance,
        weight: m.weight,
      })),
    })),
  });
}
