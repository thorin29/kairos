import { prisma } from "@/lib/prisma";
import { toDateColumn, fromDateColumn, todayISO } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import type { WorkoutCategory, MuscleGroup } from "@/lib/workouts/catalog";

async function rotationIdFor(userId: string): Promise<string | null> {
  const r = await prisma.workoutRotation.findUnique({ where: { userId }, select: { id: true } });
  return r?.id ?? null;
}

/** A plan change takes effect today, not retroactively. If the rotation is
 *  anchored in the past, editing its shape would otherwise make the generator
 *  recompute (and re-prompt) already-passed days under the new shape -- a false
 *  "overdue last week" backlog. Rolling the anchor up to today starts the edited
 *  plan immediately (at slot 0) and lets the generator sweep those phantom
 *  prompts. A future anchor the user set on purpose is left alone. */
async function reanchorTodayIfPast(userId: string): Promise<void> {
  const r = await prisma.workoutRotation.findUnique({
    where: { userId },
    select: { anchorDate: true },
  });
  if (r && fromDateColumn(r.anchorDate) < todayISO()) {
    await prisma.workoutRotation.update({
      where: { userId },
      data: { anchorDate: toDateColumn(todayISO()) },
    });
  }
}

/** Put a person on a rotation (creating an empty one anchored today). */
export async function startRotationCore(userId: string): Promise<void> {
  const existing = await prisma.workoutRotation.findUnique({ where: { userId } });
  if (existing) {
    if (!existing.isActive) {
      await prisma.workoutRotation.update({ where: { userId }, data: { isActive: true } });
    }
  } else {
    await prisma.workoutRotation.create({ data: { userId, anchorDate: toDateColumn(todayISO()) } });
  }
  await generateWorkoutTasks();
}

/** Switch back to the weekly plan. Deactivates the rotation (keeping it and its
 *  slots) rather than deleting, so it can be switched back to later. */
export async function stopRotationCore(userId: string): Promise<void> {
  await prisma.workoutRotation.updateMany({ where: { userId }, data: { isActive: false } });
  await generateWorkoutTasks();
}

export async function setRestDaysCore(userId: string, restMask: number): Promise<void> {
  const mask = Math.max(0, Math.min(127, Math.trunc(restMask)));
  await prisma.workoutRotation.updateMany({ where: { userId }, data: { restMask: mask } });
  await reanchorTodayIfPast(userId);
  await generateWorkoutTasks();
}

export async function setAnchorCore(userId: string, dateISO: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;
  await prisma.workoutRotation.updateMany({ where: { userId }, data: { anchorDate: toDateColumn(dateISO) } });
  await generateWorkoutTasks();
}

export async function addSlotCore(
  userId: string,
  input: { name: string; category?: string | null; muscleGroup?: string | null; isRest?: boolean },
): Promise<void> {
  const rotationId = await rotationIdFor(userId);
  if (!rotationId) return;
  const count = await prisma.rotationSlot.count({ where: { rotationId } });
  const isRest = input.isRest ?? false;
  await prisma.rotationSlot.create({
    data: {
      rotationId,
      position: count,
      name: (input.name?.trim() || (isRest ? "Rest" : "Workout")).slice(0, 40),
      category: isRest ? null : ((input.category ?? null) as WorkoutCategory | null),
      muscleGroup: isRest ? null : ((input.muscleGroup ?? null) as MuscleGroup | null),
      isRest,
    },
  });
  await reanchorTodayIfPast(userId);
  await generateWorkoutTasks();
}

export async function removeSlotCore(slotId: string, userId: string): Promise<"ok" | "not_found" | "forbidden"> {
  const slot = await prisma.rotationSlot.findUnique({
    where: { id: slotId },
    select: { rotationId: true, rotation: { select: { userId: true } } },
  });
  if (!slot) return "not_found";
  if (slot.rotation.userId !== userId) return "forbidden";
  await prisma.rotationSlot.delete({ where: { id: slotId } });
  const rest = await prisma.rotationSlot.findMany({
    where: { rotationId: slot.rotationId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  for (let i = 0; i < rest.length; i++) {
    await prisma.rotationSlot.update({ where: { id: rest[i].id }, data: { position: i } });
  }
  await reanchorTodayIfPast(userId);
  await generateWorkoutTasks();
  return "ok";
}

export async function moveSlotCore(slotId: string, userId: string, dir: -1 | 1): Promise<"ok" | "not_found" | "forbidden"> {
  const slot = await prisma.rotationSlot.findUnique({
    where: { id: slotId },
    select: { id: true, rotationId: true, position: true, rotation: { select: { userId: true } } },
  });
  if (!slot) return "not_found";
  if (slot.rotation.userId !== userId) return "forbidden";
  const neighbour = await prisma.rotationSlot.findFirst({
    where: { rotationId: slot.rotationId, position: slot.position + dir },
    select: { id: true, position: true },
  });
  if (!neighbour) return "ok";
  await prisma.rotationSlot.update({ where: { id: slot.id }, data: { position: -1 } });
  await prisma.rotationSlot.update({ where: { id: neighbour.id }, data: { position: slot.position } });
  await prisma.rotationSlot.update({ where: { id: slot.id }, data: { position: neighbour.position } });
  await reanchorTodayIfPast(userId);
  await generateWorkoutTasks();
  return "ok";
}
