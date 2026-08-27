"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import type { WorkoutCategory, MuscleGroup } from "@/lib/workouts/catalog";

function refresh() {
  revalidatePath("/exercise");
  revalidatePath("/admin/exercise");
  revalidatePath("/");
}

async function rotationIdFor(userId: string): Promise<string | null> {
  const r = await prisma.workoutRotation.findUnique({
    where: { userId },
    select: { id: true },
  });
  return r?.id ?? null;
}

/** Put a person on a rotation (creating an empty one anchored today if they
 *  don't have one yet). Its presence is what switches them off the weekly plan. */
export async function startRotation(userId: string): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId) return;
  const existing = await prisma.workoutRotation.findUnique({ where: { userId } });
  if (existing) {
    if (!existing.isActive) {
      await prisma.workoutRotation.update({
        where: { userId },
        data: { isActive: true },
      });
    }
  } else {
    await prisma.workoutRotation.create({
      data: { userId, anchorDate: toDateColumn(todayISO()) },
    });
  }
  await generateWorkoutTasks();
  refresh();
}

/** Return a person to the weekly plan by removing their rotation (slots cascade). */
export async function stopRotation(userId: string): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId) return;
  await prisma.workoutRotation.deleteMany({ where: { userId } });
  await generateWorkoutTasks();
  refresh();
}

/** Fixed rest weekdays as a bitmask (bit i, 0=Sun..6=Sat). These pause the cycle. */
export async function setRotationRestDays(
  userId: string,
  restMask: number,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId) return;
  const mask = Math.max(0, Math.min(127, Math.trunc(restMask)));
  await prisma.workoutRotation.updateMany({
    where: { userId },
    data: { restMask: mask },
  });
  await generateWorkoutTasks();
  refresh();
}

/** Move day 0 of the cycle. */
export async function setRotationAnchor(
  userId: string,
  dateISO: string,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;
  await prisma.workoutRotation.updateMany({
    where: { userId },
    data: { anchorDate: toDateColumn(dateISO) },
  });
  await generateWorkoutTasks();
  refresh();
}

export async function addRotationSlot(
  userId: string,
  input: {
    name: string;
    category?: WorkoutCategory | null;
    muscleGroup?: MuscleGroup | null;
    isRest?: boolean;
  },
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  const rotationId = await rotationIdFor(userId);
  if (!rotationId) return;
  const count = await prisma.rotationSlot.count({ where: { rotationId } });
  const isRest = input.isRest ?? false;
  await prisma.rotationSlot.create({
    data: {
      rotationId,
      position: count,
      name: (input.name?.trim() || (isRest ? "Rest" : "Workout")).slice(0, 40),
      category: isRest ? null : (input.category ?? null),
      muscleGroup: isRest ? null : (input.muscleGroup ?? null),
      isRest,
    },
  });
  await generateWorkoutTasks();
  refresh();
}

export async function updateRotationSlot(
  slotId: string,
  patch: {
    name?: string;
    category?: WorkoutCategory | null;
    muscleGroup?: MuscleGroup | null;
  },
): Promise<void> {
  await requireInteractive();
  if (!slotId) return;
  const uslot = await prisma.rotationSlot.findUnique({
    where: { id: slotId },
    select: { rotation: { select: { userId: true } } },
  });
  if (!uslot) return;
  await requireCanActFor(uslot.rotation.userId);
  const data: {
    name?: string;
    category?: WorkoutCategory | null;
    muscleGroup?: MuscleGroup | null;
  } = {};
  if (patch.name !== undefined) data.name = patch.name.trim().slice(0, 40) || "Workout";
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.muscleGroup !== undefined) data.muscleGroup = patch.muscleGroup;
  await prisma.rotationSlot.update({ where: { id: slotId }, data });
  await generateWorkoutTasks();
  refresh();
}

export async function removeRotationSlot(slotId: string): Promise<void> {
  await requireInteractive();
  if (!slotId) return;
  const slot = await prisma.rotationSlot.findUnique({
    where: { id: slotId },
    select: { rotationId: true, rotation: { select: { userId: true } } },
  });
  if (!slot) return;
  await requireCanActFor(slot.rotation.userId);
  await prisma.rotationSlot.delete({ where: { id: slotId } });
  // Re-pack positions so they stay contiguous 0..n-1.
  const rest = await prisma.rotationSlot.findMany({
    where: { rotationId: slot.rotationId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  for (let i = 0; i < rest.length; i++) {
    await prisma.rotationSlot.update({
      where: { id: rest[i].id },
      data: { position: i },
    });
  }
  await generateWorkoutTasks();
  refresh();
}

/** Swap a slot with its neighbour (dir -1 up, +1 down). */
export async function moveRotationSlot(
  slotId: string,
  dir: -1 | 1,
): Promise<void> {
  await requireInteractive();
  if (!slotId) return;
  const slot = await prisma.rotationSlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      rotationId: true,
      position: true,
      rotation: { select: { userId: true } },
    },
  });
  if (!slot) return;
  await requireCanActFor(slot.rotation.userId);
  const neighbour = await prisma.rotationSlot.findFirst({
    where: { rotationId: slot.rotationId, position: slot.position + dir },
    select: { id: true, position: true },
  });
  if (!neighbour) return;
  // Two-step swap around a temporary position to respect the unique constraint.
  await prisma.rotationSlot.update({
    where: { id: slot.id },
    data: { position: -1 },
  });
  await prisma.rotationSlot.update({
    where: { id: neighbour.id },
    data: { position: slot.position },
  });
  await prisma.rotationSlot.update({
    where: { id: slot.id },
    data: { position: neighbour.position },
  });
  await generateWorkoutTasks();
  refresh();
}
