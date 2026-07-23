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

export async function deleteTask(id: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;
  await prisma.task.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
}
