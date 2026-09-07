import { WorkoutCategory, WorkoutType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type PersonalWorkoutInput = {
  name: string;
  type: WorkoutType;
  capSec?: number | null;
  notes?: string | null;
  movements: { poolExerciseId: string; reps?: number | null; distance?: number | null; weight?: number | null }[];
};

/** Create a HIIT/CrossFit workout owned by this person (approved, never a hero). */
export async function createPersonalWorkoutCore(
  userId: string,
  input: PersonalWorkoutInput,
): Promise<{ error: string | null }> {
  const name = input.name.trim().slice(0, 60);
  if (name.length < 2) return { error: "Give the workout a name." };
  const movements = input.movements.filter((m) => m.poolExerciseId);
  if (movements.length === 0) return { error: "Add at least one movement." };

  await prisma.hiitWorkout.create({
    data: {
      name,
      type: input.type,
      ownerId: userId,
      approved: true,
      heroWod: false,
      capSec: input.capSec ?? null,
      notes: input.notes?.trim() || null,
      sortOrder: 0,
      movements: {
        create: movements.map((m, i) => ({
          poolExerciseId: m.poolExerciseId,
          reps: m.reps ?? null,
          distance: m.distance ?? null,
          weight: m.weight ?? null,
          position: i,
        })),
      },
    },
  });
  return { error: null };
}

/** Share a personal workout: give the target person their own copy. */
export async function sharePersonalWorkoutCore(
  userId: string,
  workoutId: string,
  targetUserId: string,
): Promise<{ error: string | null }> {
  if (!targetUserId || targetUserId === userId) return { error: "Pick someone to share with." };
  const w = await prisma.hiitWorkout.findFirst({
    where: { id: workoutId, ownerId: userId },
    include: { movements: { orderBy: { position: "asc" } } },
  });
  if (!w) return { error: "Workout not found." };
  const target = await prisma.user.findFirst({ where: { id: targetUserId, isActive: true }, select: { id: true } });
  if (!target) return { error: "That person isn't available." };

  await prisma.hiitWorkout.create({
    data: {
      name: w.name,
      type: w.type,
      ownerId: targetUserId,
      approved: true,
      heroWod: false,
      capSec: w.capSec,
      pyramidStart: w.pyramidStart,
      pyramidEnd: w.pyramidEnd,
      pyramidStep: w.pyramidStep,
      notes: w.notes,
      sortOrder: 0,
      movements: {
        create: w.movements.map((m) => ({
          poolExerciseId: m.poolExerciseId,
          reps: m.reps,
          distance: m.distance,
          weight: m.weight,
          position: m.position,
        })),
      },
    },
  });
  return { error: null };
}

/** Full edit of one of this person's own workouts (name, type, cap, exercises). */
export async function updatePersonalWorkoutCore(
  userId: string,
  workoutId: string,
  input: PersonalWorkoutInput,
): Promise<{ error: string | null }> {
  const owned = await prisma.hiitWorkout.findFirst({
    where: { id: workoutId, ownerId: userId },
    select: { id: true },
  });
  if (!owned) return { error: "Workout not found." };
  const name = input.name.trim().slice(0, 60);
  if (name.length < 2) return { error: "Give the workout a name." };
  const movements = input.movements.filter((m) => m.poolExerciseId);
  if (movements.length === 0) return { error: "Add at least one exercise." };

  await prisma.$transaction([
    prisma.hiitWorkoutMovement.deleteMany({ where: { hiitWorkoutId: workoutId } }),
    prisma.hiitWorkout.update({
      where: { id: workoutId },
      data: {
        name,
        type: input.type,
        capSec: input.capSec ?? null,
        notes: input.notes?.trim() || null,
        movements: {
          create: movements.map((m, i) => ({
            poolExerciseId: m.poolExerciseId,
            reps: m.reps ?? null,
            distance: m.distance ?? null,
            weight: m.weight ?? null,
            position: i,
          })),
        },
      },
    }),
  ]);
  return { error: null };
}

/** Delete one of this person's own workouts. */
export async function deletePersonalWorkoutCore(
  userId: string,
  workoutId: string,
): Promise<{ error: string | null }> {
  await prisma.hiitWorkout.deleteMany({ where: { id: workoutId, ownerId: userId } });
  return { error: null };
}

/** Add a custom movement that shows only in this person's menus (or reuse an
 *  existing shared/own one with the same name). Returns its id. */
export async function addUserMovementCore(
  userId: string,
  category: WorkoutCategory,
  name: string,
): Promise<{ error: string | null; id?: string }> {
  const nm = name.trim().slice(0, 50);
  if (nm.length < 2) return { error: "Name the movement." };
  const existing = await prisma.poolExercise.findFirst({
    where: { category, name: nm, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true },
  });
  if (existing) return { error: null, id: existing.id };
  const created = await prisma.poolExercise.create({
    data: { category, name: nm, ownerId: userId, isActive: true },
  });
  return { error: null, id: created.id };
}
