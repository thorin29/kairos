import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";

/**
 * Create a general assigned task (Category.OTHER) for a user — the "assign a
 * task" flow. Auth-free core; the caller checks it may act for `userId`. A blank
 * due date defaults to today so it appears on the person's home right away and
 * stays (as overdue) until done.
 */
export async function addTaskCore(input: {
  userId: string;
  title: string;
  dueDate?: string | null;
  notifyMinutes?: number | null;
}): Promise<{ error: string | null }> {
  const title = input.title.trim().slice(0, 120);
  if (!input.userId) return { error: "Pick who this is for." };
  if (title.length < 2) return { error: "Give the task a name." };
  const dueDate = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : todayISO();
  await prisma.task.create({
    data: {
      userId: input.userId,
      title,
      category: Category.OTHER,
      dueDate: toDateColumn(dueDate),
      notifyMinutes: input.notifyMinutes ?? null,
    },
  });
  return { error: null };
}
