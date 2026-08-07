"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { Category, SchoolWorkType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";

export type SchoolActionState = { error: string | null };

const TYPES = ["HOMEWORK", "ASSIGNMENT", "TEST", "PROJECT"] as const;

/**
 * A school assignment/test is a SCHOOL task with a SchoolWork detail row (type +
 * subject). Due date only, no time — timed classes live on the calendar. Added
 * by a student from their day, or by a parent from admin.
 */
export async function addSchoolWork(
  _prev: SchoolActionState,
  formData: FormData,
): Promise<SchoolActionState> {
  await requireInteractive();
  const userId = String(formData.get("userId") ?? "");
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 120);
  const subject =
    String(formData.get("subject") ?? "")
      .trim()
      .slice(0, 60) || null;
  const rawType = String(formData.get("type") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "") || todayISO();

  if (!userId) return { error: "Pick who this is for." };
  if (title.length < 2) return { error: "Give the assignment a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { error: "That date isn't valid." };
  }
  const type: SchoolWorkType = (TYPES as readonly string[]).includes(rawType)
    ? (rawType as SchoolWorkType)
    : "ASSIGNMENT";

  await prisma.task.create({
    data: {
      userId,
      title,
      category: Category.SCHOOL,
      dueDate: toDateColumn(dueDate),
      schoolWork: { create: { type, subject } },
    },
  });

  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  revalidatePath("/admin/school");
  return { error: null };
}

/** Delete a school item (the SchoolWork detail cascades with the task). */
export async function deleteSchoolWork(taskId: string): Promise<void> {
  await requireInteractive();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true },
  });
  await prisma.task.delete({ where: { id: taskId } }).catch(() => {});
  revalidatePath("/");
  if (task) revalidatePath(`/person/${task.userId}`);
  revalidatePath("/admin/school");
}
