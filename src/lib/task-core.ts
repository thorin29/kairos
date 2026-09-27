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
  clientId?: string | null;
}): Promise<{ error: string | null; id?: string }> {
  const title = input.title.trim().slice(0, 120);
  if (!input.userId) return { error: "Pick who this is for." };
  if (title.length < 2) return { error: "Give the task a name." };
  const dueDate = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : todayISO();
  // Idempotency: a retried offline create whose response was lost returns the
  // already-created row instead of duplicating it.
  const clientId = (input.clientId ?? "").trim() || null;
  if (clientId) {
    const existing = await prisma.task.findFirst({ where: { userId: input.userId, clientId } });
    if (existing) return { error: null, id: existing.id };
  }
  const task = await prisma.task.create({
    data: {
      userId: input.userId,
      title,
      category: Category.OTHER,
      dueDate: toDateColumn(dueDate),
      notifyMinutes: input.notifyMinutes ?? null,
      clientId,
    },
  });
  return { error: null, id: task.id };
}
