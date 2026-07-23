"use server";

import { revalidatePath } from "next/cache";
import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";

export type TaskActionState = { error: string | null };

export async function addTask(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const userId = String(formData.get("userId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const rawCategory = String(formData.get("category") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "") || todayISO();

  if (!userId) return { error: "Pick who this is for." };
  if (title.length < 2) return { error: "Give the task a name." };

  const category = (Object.values(Category) as string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : Category.OTHER;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { error: "That date isn't valid." };
  }

  await prisma.task.create({
    data: {
      userId,
      title,
      category,
      dueDate: toDateColumn(dueDate),
    },
  });

  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  return { error: null };
}

export async function toggleTask(id: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;

  const nowComplete = task.status !== TaskStatus.COMPLETE;

  await prisma.task.update({
    where: { id },
    data: {
      status: nowComplete ? TaskStatus.COMPLETE : TaskStatus.PENDING,
      completedAt: nowComplete ? new Date() : null,
    },
  });

  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
}

/**
 * Hand a chore back to the household. It stays due on the same day and keeps
 * its slot, but stops counting toward the original person until claimed.
 */
export async function releaseTask(id: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.status === TaskStatus.COMPLETE) return;

  await prisma.task.update({
    where: { id },
    data: { isOpen: true },
  });

  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
}

export type ClaimState = { error: string | null };

export async function claimTask(
  id: string,
  userId: string,
): Promise<ClaimState> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return { error: "That task is gone." };
  if (!task.isOpen) return { error: "Someone already picked that up." };

  // The unique index on (chore, person, day) means a person can't hold the
  // same chore twice in a day.
  if (task.choreId) {
    const clash = await prisma.task.findFirst({
      where: {
        choreId: task.choreId,
        userId,
        dueDate: task.dueDate,
        id: { not: id },
      },
    });
    if (clash) return { error: "They already have that chore today." };
  }

  const previousOwner = task.userId;

  await prisma.task.update({
    where: { id },
    data: { userId, isOpen: false },
  });

  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  revalidatePath(`/person/${previousOwner}`);
  return { error: null };
}

export async function deleteTask(id: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;
  await prisma.task.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
}
