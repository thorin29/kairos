"use server";

import { revalidatePath } from "next/cache";
import { syncPlanUnitDone } from "@/lib/school/plan-unit-sync";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { Category, TaskStatus } from "@/generated/prisma/client";
import { addTaskCore, tellAssigned } from "@/lib/task-core";
import { currentUser } from "@/lib/user-session";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";
import { claimTaskCore } from "@/lib/chores/dashboard-actions-core";

export type TaskActionState = { error: string | null };

export async function addTask(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requireInteractive();
  const userId = String(formData.get("userId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const rawCategory = String(formData.get("category") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "") || todayISO();

  if (!userId) return { error: "Pick who this is for." };
  await requireCanActFor(userId);
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
  await tellAssigned(userId, (await currentUser())?.id ?? null, title);

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath(`/person/${userId}`);
  return { error: null };
}

export async function toggleTask(id: string): Promise<void> {
  await requireInteractive();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;
  await requireCanActFor(task.userId);

  const nowComplete = task.status !== TaskStatus.COMPLETE;

  await prisma.task.update({
    where: { id },
    data: {
      status: nowComplete ? TaskStatus.COMPLETE : TaskStatus.PENDING,
      completedAt: nowComplete ? new Date() : null,
    },
  });
  // Schoolwork also owns a plan unit, whose done flag is stored rather than
  // derived. No-op for every other kind of task.
  await syncPlanUnitDone(id, nowComplete);

  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
  revalidatePath("/tasks");
  revalidatePath("/admin/school");
}

/**
 * Hand a chore back to the household. It stays due on the same day and keeps
 * its slot, but stops counting toward the original person until claimed.
 */
export async function releaseTask(id: string): Promise<void> {
  await requireInteractive();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.status === TaskStatus.COMPLETE) return;
  await requireCanActFor(task.userId);

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
  await requireInteractive();
  await requireCanActFor(userId);
  return claimTaskCore(id, userId);
}

/**
 * One-click "up for grabs": claim an open task for a person AND mark it done in
 * a single tap. Used on each person's Chores card so grabbing a pool chore and
 * completing it is one action, attributed to whoever's card is open.
 */
export async function claimAndCompleteTask(
  id: string,
  userId: string,
): Promise<ClaimState> {
  await requireInteractive();
  await requireCanActFor(userId);
  const res = await claimTaskCore(id, userId);
  if (res.error) return res;
  await prisma.task.update({
    where: { id },
    data: { status: TaskStatus.COMPLETE, completedAt: new Date() },
  });
  await syncPlanUnitDone(id, true);
  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  revalidatePath("/tasks");
  revalidatePath("/admin/school");
  return { error: null };
}

export async function deleteTask(id: string): Promise<void> {
  await requireInteractive();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;
  await requireCanActFor(task.userId);
  await prisma.task.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/admin/tasks");
  revalidatePath(`/person/${task.userId}`);
}

/**
 * Edit a one-off task: rename, re-date, or reassign it. Used by the admin Tasks
 * page. Reassigning needs permission over the new owner too.
 */
export async function editTask(input: {
  id: string;
  title: string;
  dueDate: string;
  userId?: string;
}): Promise<{ error: string | null }> {
  await requireInteractive();
  const task = await prisma.task.findUnique({
    where: { id: input.id },
    select: { userId: true },
  });
  if (!task) return { error: "That task no longer exists." };
  await requireCanActFor(task.userId);

  const title = String(input.title ?? "").trim().slice(0, 120);
  if (title.length < 2) return { error: "Give the task a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    return { error: "That date isn't valid." };
  }

  let userId = task.userId;
  if (input.userId && input.userId !== task.userId) {
    await requireCanActFor(input.userId);
    userId = input.userId;
  }

  try {
    await prisma.task.update({
      where: { id: input.id },
      data: { title, dueDate: toDateColumn(input.dueDate), userId },
    });
  } catch (e) {
    // A generated task (a day's reading, workout or recurring task) exists
    // once per person per day (v0.793): moving it onto a day that already has
    // it is refused by the database.
    if ((e as { code?: string })?.code === "P2002") {
      return { error: "That day already has this task." };
    }
    throw e;
  }

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/admin/tasks");
  revalidatePath(`/person/${task.userId}`);
  if (userId !== task.userId) revalidatePath(`/person/${userId}`);
  return { error: null };
}

/** Typed "assign a task" used by the /tasks page (self, or anyone if admin). */
export async function assignTask(input: {
  userId: string;
  title: string;
  dueDate?: string | null;
}): Promise<{ error: string | null }> {
  await requireInteractive();
  await requireCanActFor(input.userId);
  const r = await addTaskCore(input);
  if (!r.error) await tellAssigned(input.userId, (await currentUser())?.id ?? null, input.title);
  revalidatePath("/tasks");
  revalidatePath("/");
  return r;
}

/**
 * Add a task from the web's + button (v0.803): the same choices as the app's
 * Add task — who, a due date, repeating, a reminder time. A repeat makes a
 * recurring template, the same as the device endpoint.
 */
export async function addTaskFull(input: {
  userId: string;
  title: string;
  dueDate: string | null;
  notifyMinutes: number | null;
  recur: {
    freq: string;
    interval: number;
    byday: string[];
    endMode: string;
    maxCount: number | null;
    until: string;
  } | null;
}): Promise<{ error: string | null }> {
  await requireInteractive();
  if (!input.userId) return { error: "Pick who this is for." };
  await requireCanActFor(input.userId);
  const me = (await currentUser())?.id ?? null;
  const title = String(input.title ?? "").trim().slice(0, 120);
  const notify =
    typeof input.notifyMinutes === "number" && input.notifyMinutes >= 0 && input.notifyMinutes < 1440 ? Math.round(input.notifyMinutes) : null;
  if (input.recur) {
    const { createRecurringTask } = await import("@/lib/tasks/recurring");
    const res = await createRecurringTask({
      userId: input.userId,
      title,
      freq: input.recur.freq,
      interval: Number(input.recur.interval) || 1,
      byday: Array.isArray(input.recur.byday) ? input.recur.byday.map(String) : [],
      startDate: input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : todayISO(),
      endMode: input.recur.endMode,
      maxCount: input.recur.maxCount,
      until: input.recur.until ?? "",
      notifyMinutes: notify,
      createdById: me,
    });
    if (res.error) return res;
  } else {
    const r = await addTaskCore({ userId: input.userId, title, dueDate: input.dueDate, notifyMinutes: notify });
    if (r.error) return { error: r.error };
  }
  await tellAssigned(input.userId, me, title);
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath(`/person/${input.userId}`, "layout");
  return { error: null };
}
