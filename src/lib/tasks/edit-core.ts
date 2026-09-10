import { prisma } from "@/lib/prisma";
import { fromDateColumn, todayISO } from "@/lib/dates";
import { createRecurringTask, updateRecurringTaskInPlace } from "@/lib/tasks/recurring";
import { addTaskCore } from "@/lib/task-core";

export type TaskEditData = {
  taskId: string;
  userId: string;
  title: string;
  recurring: boolean;
  dueDate: string | null;
  notifyMinutes: number | null;
  freq: string;
  interval: number;
  byday: string[];
  startDate: string;
  endMode: string;
  maxCount: number | null;
  until: string;
};

type RecurInput = {
  freq: string;
  interval: number;
  byday: string[];
  startDate: string;
  endMode: string;
  maxCount: number | null;
  until: string;
  notifyMinutes?: number | null;
};

type UpdateInput = {
  userId: string;
  title: string;
  dueDate?: string | null;
  notifyMinutes?: number | null;
  recur?: RecurInput | null;
};

const RTASK = "rtask:";

/**
 * The editable form of a task, resolving a recurring occurrence back to its
 * template so the whole series is edited as one. A one-off returns its own
 * fields; a recurring occurrence returns the template's schedule.
 */
export async function taskEditData(taskId: string): Promise<TaskEditData | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      userId: true,
      title: true,
      dueDate: true,
      notifyMinutes: true,
      generatedFrom: true,
    },
  });
  if (!task) return null;

  const gf = task.generatedFrom ?? "";
  if (gf.startsWith(RTASK)) {
    const rid = gf.slice(RTASK.length);
    const t = await prisma.recurringTask.findUnique({
      where: { id: rid },
      select: {
        userId: true,
        title: true,
        freq: true,
        interval: true,
        byday: true,
        startDate: true,
        endMode: true,
        maxCount: true,
        untilDate: true,
        notifyMinutes: true,
      },
    });
    if (t) {
      return {
        taskId,
        userId: t.userId,
        title: t.title,
        recurring: true,
        dueDate: null,
        notifyMinutes: t.notifyMinutes,
        freq: t.freq,
        interval: t.interval,
        byday: (t.byday ?? "").split(",").filter(Boolean),
        startDate: fromDateColumn(t.startDate),
        endMode: t.endMode,
        maxCount: t.maxCount,
        until: t.untilDate ? fromDateColumn(t.untilDate) : "",
      };
    }
  }

  const due = fromDateColumn(task.dueDate);
  return {
    taskId,
    userId: task.userId,
    title: task.title,
    recurring: false,
    dueDate: due,
    notifyMinutes: task.notifyMinutes,
    freq: "WEEKLY",
    interval: 1,
    byday: [],
    startDate: due || todayISO(),
    endMode: "NEVER",
    maxCount: null,
    until: "",
  };
}

/** Remove whatever the task currently is (a one-off, or a whole recurring series). */
async function removeExisting(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { generatedFrom: true },
  });
  const gf = task?.generatedFrom ?? "";
  if (gf.startsWith(RTASK)) {
    const rid = gf.slice(RTASK.length);
    await prisma.task.deleteMany({ where: { generatedFrom: `${RTASK}${rid}` } });
    await prisma.recurringTask.delete({ where: { id: rid } }).catch(() => {});
  } else {
    await prisma.task.delete({ where: { id: taskId } }).catch(() => {});
  }
}

/**
 * Full edit ("as if creating new"): drop the existing task/series and recreate it
 * in the requested shape. Handles every one-off↔recurring transition uniformly.
 * The requester must own the task or be able to manage the family.
 */
export async function updateTask(
  taskId: string,
  input: UpdateInput,
  canManage: boolean,
  requesterId: string,
): Promise<{ error: string | null }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true, generatedFrom: true },
  });
  if (!task) return { error: "No such task." };
  if (!canManage && task.userId !== requesterId) {
    return { error: "Not your task." };
  }

  const gf = task.generatedFrom ?? "";
  const rid = gf.startsWith(RTASK) ? gf.slice(RTASK.length) : null;

  // Recurring → recurring: edit the series in place so completed history is kept
  // (the generator's last-2-completed prune trims it). Other transitions redefine
  // the task, so they drop the old form and recreate.
  if (rid && input.recur) {
    return updateRecurringTaskInPlace(rid, {
      userId: input.userId,
      title: input.title,
      freq: input.recur.freq,
      interval: input.recur.interval,
      byday: input.recur.byday,
      startDate: input.recur.startDate,
      endMode: input.recur.endMode,
      maxCount: input.recur.maxCount,
      until: input.recur.until,
      notifyMinutes: input.recur.notifyMinutes ?? null,
      createdById: requesterId,
    });
  }

  await removeExisting(taskId);

  if (input.recur) {
    return createRecurringTask({
      userId: input.userId,
      title: input.title,
      freq: input.recur.freq,
      interval: input.recur.interval,
      byday: input.recur.byday,
      startDate: input.recur.startDate,
      endMode: input.recur.endMode,
      maxCount: input.recur.maxCount,
      until: input.recur.until,
      notifyMinutes: input.recur.notifyMinutes ?? null,
      createdById: requesterId,
    });
  }
  return addTaskCore({
    userId: input.userId,
    title: input.title,
    dueDate: input.dueDate ?? null,
    notifyMinutes: input.notifyMinutes ?? null,
  });
}

/** Delete a one-off, or a whole recurring series (template + every occurrence). */
export async function deleteTask(
  taskId: string,
  canManage: boolean,
  requesterId: string,
): Promise<{ error: string | null }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true },
  });
  if (!task) return { error: "No such task." };
  if (!canManage && task.userId !== requesterId) {
    return { error: "Not your task." };
  }
  await removeExisting(taskId);
  return { error: null };
}
