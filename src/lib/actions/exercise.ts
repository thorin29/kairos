"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { toDateColumn, todayISO } from "@/lib/dates";
import { generateExercise } from "@/lib/exercise/generate";

function refreshAdmin() {
  revalidatePath("/admin/exercise");
  revalidatePath("/exercise");
  revalidatePath("/");
}

// --- routines ------------------------------------------------------------

export async function addRoutine(name: string): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 60);
  if (!clean) return;
  const count = await prisma.exerciseRoutine.count();
  await prisma.exerciseRoutine.create({
    data: { name: clean, sortOrder: count },
  });
  refreshAdmin();
}

export async function updateRoutine(
  id: string,
  data: { name?: string; isActive?: boolean },
): Promise<void> {
  await requireAdmin();
  await prisma.exerciseRoutine.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim().slice(0, 60) } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
  await generateExercise();
  refreshAdmin();
}

export async function deleteRoutine(id: string): Promise<void> {
  await requireAdmin();
  await prisma.exerciseRoutine.delete({ where: { id } });
  await generateExercise();
  refreshAdmin();
}

// --- movements -----------------------------------------------------------

export async function addExercise(routineId: string, name: string): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 60);
  if (!clean) return;
  const count = await prisma.routineExercise.count({ where: { routineId } });
  await prisma.routineExercise.create({
    data: { routineId, name: clean, sortOrder: count },
  });
  refreshAdmin();
}

export async function updateExercise(
  id: string,
  data: { name?: string; sets?: number; reps?: string; weight?: string | null },
): Promise<void> {
  await requireAdmin();
  await prisma.routineExercise.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim().slice(0, 60) } : {}),
      ...(data.sets !== undefined ? { sets: Math.max(1, Math.min(50, data.sets)) } : {}),
      ...(data.reps !== undefined ? { reps: data.reps.trim().slice(0, 20) } : {}),
      ...(data.weight !== undefined
        ? { weight: data.weight ? data.weight.trim().slice(0, 20) : null }
        : {}),
    },
  });
  refreshAdmin();
}

export async function deleteExercise(id: string): Promise<void> {
  await requireAdmin();
  await prisma.routineExercise.delete({ where: { id } });
  refreshAdmin();
}

// --- assignment ----------------------------------------------------------

export async function setAssignment(
  routineId: string,
  userId: string,
  dayOfWeek: number,
  active: boolean,
): Promise<void> {
  await requireAdmin();
  if (dayOfWeek < 0 || dayOfWeek > 6) return;

  if (active) {
    await prisma.routineAssignment.upsert({
      where: { routineId_userId_dayOfWeek: { routineId, userId, dayOfWeek } },
      update: { isActive: true },
      create: { routineId, userId, dayOfWeek, isActive: true },
    });
  } else {
    await prisma.routineAssignment.deleteMany({
      where: { routineId, userId, dayOfWeek },
    });
  }

  await generateExercise();
  refreshAdmin();
}

// --- logging (open, from the shared screen) ------------------------------

export async function logExercise(
  userId: string,
  exerciseId: string,
  data: { sets?: number | null; reps?: number | null; weight?: number | null },
): Promise<void> {
  const day = toDateColumn(todayISO());
  const clean = {
    sets: data.sets ?? null,
    reps: data.reps ?? null,
    weight: data.weight ?? null,
  };

  await prisma.exerciseLog.upsert({
    where: { userId_exerciseId_day: { userId, exerciseId, day } },
    update: clean,
    create: { userId, exerciseId, day, ...clean },
  });
  revalidatePath("/exercise");
}

/** Mark a person's whole workout done (or not) for today. */
export async function setWorkoutDone(taskId: string, done: boolean): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: done ? "COMPLETE" : "PENDING",
      completedAt: done ? new Date() : null,
    },
  });
  revalidatePath("/exercise");
  revalidatePath("/");
}
