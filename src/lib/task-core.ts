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

/**
 * "<name> gave you a task" (v0.772), for people who turned that on in their
 * app. Not for a task someone adds for themselves. Best-effort.
 */
export async function tellAssigned(userId: string, byId: string | null, title: string): Promise<void> {
  if (!byId || byId === userId) return;
  try {
    const { loadPrefs } = await import("@/lib/notify-prefs");
    if (!(await loadPrefs(userId)).prefs.assigned) return;
    const by = (await prisma.user.findUnique({ where: { id: byId }, select: { name: true, displayName: true } })) as {
      name: string;
      displayName: string | null;
    } | null;
    const { notify } = await import("@/lib/push");
    await notify([userId], { kind: "task", title: `${by ? by.displayName || by.name : "Someone"} gave you a task`, body: title.trim().slice(0, 120), link: "/tasks" }, { quiet: true });
  } catch {
    // never block adding a task on a notification
  }
}
