import { Category, type SchoolWorkType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";
import { SCHOOL_TYPES } from "@/lib/school";

/**
 * Add a school item (an assignment / test / etc., stored as a SCHOOL Task with a
 * SchoolWork detail). Auth-free core for the app's device endpoint; the caller
 * checks it may act for `userId`. Created as a window item worked from today.
 */
export async function addSchoolWorkCore(input: {
  userId: string;
  title: string;
  subject?: string | null;
  type?: string | null;
  dueDate: string;
  classId?: string | null;
}): Promise<{ error: string | null }> {
  const userId = input.userId;
  const title = input.title.trim().slice(0, 120);
  const subject = (input.subject ?? "").trim().slice(0, 60) || null;
  const dueDate = input.dueDate;

  if (!userId) return { error: "Pick who this is for." };
  if (title.length < 2) return { error: "Give the assignment a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: "That date isn't valid." };

  const type: SchoolWorkType = (SCHOOL_TYPES as readonly string[]).includes(input.type ?? "")
    ? (input.type as SchoolWorkType)
    : "ASSIGNMENT";

  // Only accept a class this student is actually a member of.
  let classId: string | null = null;
  if (input.classId) {
    const member = await prisma.classMember.findFirst({
      where: { classId: input.classId, userId },
      select: { classId: true },
    });
    classId = member?.classId ?? null;
  }

  await prisma.task.create({
    data: {
      userId,
      title,
      category: Category.SCHOOL,
      dueDate: toDateColumn(dueDate),
      schoolWork: {
        create: {
          type,
          subject,
          classId,
          dateSpecific: false,
          startDate: toDateColumn(todayISO()),
          dueMinutes: null,
        },
      },
    },
  });
  return { error: null };
}

/** Delete a school item. Returns the owner id (for an auth check) or null. */
export async function schoolTaskOwner(taskId: string): Promise<string | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true },
  });
  return task?.userId ?? null;
}

export async function deleteSchoolWorkCore(taskId: string): Promise<void> {
  await prisma.task.delete({ where: { id: taskId } }).catch(() => {});
}

/** Rename a school item (updates the task title). Auth-free core. */
export async function renameSchoolWorkCore(
  taskId: string,
  title: string,
): Promise<{ error: string | null }> {
  const t = title.trim().slice(0, 120);
  if (t.length < 2) return { error: "Give the assignment a name." };
  await prisma.task.update({ where: { id: taskId }, data: { title: t } }).catch(() => {});
  return { error: null };
}
