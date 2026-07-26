"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { clampEffort } from "@/lib/chores/effort";
import { toDateColumn, todayISO } from "@/lib/dates";
import { generateChores } from "@/lib/chores/generate";
import { generatePoolChores } from "@/lib/chores/pool";
import { isAdmin, requireAdmin } from "@/lib/session";

export type ChoreActionState = { error: string | null };

/** Master list: the set of jobs that exist, independent of who does them. */
export async function addChore(
  _prev: ChoreActionState,
  formData: FormData,
): Promise<ChoreActionState> {
  if (!(await isAdmin())) return { error: "Only a parent can change this. Switch profiles first." };

  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  if (title.length < 2) return { error: "Give the chore a name." };

  const existing = await prisma.chore.findUnique({ where: { title } });
  if (existing) return { error: `"${title}" is already on the list.` };

  const effort = clampEffort(Number(formData.get("effort")));
  const count = await prisma.chore.count();
  await prisma.chore.create({ data: { title, sortOrder: count, effort } });

  revalidatePath("/admin/chores");
  revalidatePath("/chores");
  return { error: null };
}

/** Change a chore's admin-only effort weight. */
export async function setChoreEffort(id: string, effort: number): Promise<void> {
  await requireAdmin();
  const chore = await prisma.chore.findUnique({ where: { id }, select: { effortLocked: true } });
  if (chore?.effortLocked) return; // locked: ignore stray changes
  await prisma.chore.update({
    where: { id },
    data: { effort: clampEffort(effort) },
  });
  revalidatePath("/admin/chores");
}

/** Lock or unlock a chore's effort so it isn't changed by accident. */
export async function setChoreEffortLocked(id: string, locked: boolean): Promise<void> {
  await requireAdmin();
  await prisma.chore.update({ where: { id }, data: { effortLocked: locked } });
  revalidatePath("/admin/chores");
}

export async function deleteChore(id: string): Promise<void> {
  await requireAdmin();

  // Finished tasks keep their title and history; only the link is cleared.
  await prisma.chore.delete({ where: { id } });
  revalidatePath("/chores");
  revalidatePath("/");
}

/**
 * Assign an existing chore to one person on one weekday. Repeats weekly
 * from today forward; days already generated are left alone so nobody
 * loses credit for something finished.
 */
export async function assignChore(
  _prev: ChoreActionState,
  formData: FormData,
): Promise<ChoreActionState> {
  if (!(await isAdmin())) return { error: "Only a parent can change this. Switch profiles first." };

  const choreId = String(formData.get("choreId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const dayOfWeek = Number(formData.get("dayOfWeek"));

  if (!choreId) return { error: "Pick a chore." };
  if (!userId) return { error: "Pick who does it." };
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: "Pick a day." };
  }

  const existing = await prisma.choreAssignment.findUnique({
    where: { choreId_userId_dayOfWeek: { choreId, userId, dayOfWeek } },
  });
  if (existing) return { error: "That's already assigned." };

  await prisma.choreAssignment.create({
    data: { choreId, userId, dayOfWeek, effectiveFrom: toDateColumn(todayISO()) },
  });

  await generateChores();

  revalidatePath("/chores");
  revalidatePath("/");
  return { error: null };
}

export async function removeAssignment(id: string): Promise<void> {
  await requireAdmin();

  const assignment = await prisma.choreAssignment.findUnique({ where: { id } });
  if (!assignment) return;

  await prisma.choreAssignment.delete({ where: { id } });

  // Reconciling clears out the unfinished instances this assignment left
  // behind, today's included. Completed ones and anything before today are
  // left alone.
  await generateChores();

  revalidatePath("/chores");
  revalidatePath("/");
}

/**
 * A shared chore: no assignee, no weekday, just an interval measured from
 * whenever it was last finished.
 */
export async function addPoolChore(
  _prev: ChoreActionState,
  formData: FormData,
): Promise<ChoreActionState> {
  if (!(await isAdmin())) return { error: "Only a parent can change this. Switch profiles first." };

  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const intervalDays = Number(formData.get("intervalDays") ?? 0);

  if (title.length < 2) return { error: "Give the chore a name." };
  if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365) {
    return { error: "Set how many days between rounds, from 1 to 365." };
  }

  const existing = await prisma.chore.findUnique({ where: { title } });
  if (existing) return { error: `"${title}" is already on the list.` };

  const effort = clampEffort(Number(formData.get("effort")));
  const count = await prisma.chore.count();
  await prisma.chore.create({
    data: { title, isPool: true, intervalDays, sortOrder: count, effort },
  });

  await generatePoolChores();

  revalidatePath("/admin/chores");
  revalidatePath("/chores");
  revalidatePath("/");
  return { error: null };
}

export async function setChorePaused(
  id: string,
  paused: boolean,
): Promise<void> {
  await requireAdmin();

  await prisma.chore.update({
    where: { id },
    data: { isPaused: paused },
  });

  if (paused) {
    // Pull the outstanding round. Anything already finished stays counted.
    await prisma.task.deleteMany({
      where: { choreId: id, status: "PENDING" },
    });
  } else {
    // Resuming puts one out today rather than waiting a full interval.
    await generatePoolChores();
  }

  revalidatePath("/chores");
  revalidatePath("/");
}

/**
 * Move an existing assignment to a different person and/or day. The assignment
 * keeps its identity, so reconciliation shifts the unfinished instances to the
 * new person and day while leaving completed history alone. If the target slot
 * already exists, the moved one is dropped rather than duplicated.
 */
export async function reassignChore(
  assignmentId: string,
  userId: string,
  dayOfWeek: number,
): Promise<void> {
  await requireAdmin();
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return;

  const assignment = await prisma.choreAssignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) return;

  const clash = await prisma.choreAssignment.findFirst({
    where: {
      choreId: assignment.choreId,
      userId,
      dayOfWeek,
      NOT: { id: assignmentId },
    },
  });

  if (clash) {
    // The destination already has this chore on this day — just retire the
    // one being moved so it isn't a duplicate.
    await prisma.choreAssignment.delete({ where: { id: assignmentId } });
  } else {
    await prisma.choreAssignment.update({
      where: { id: assignmentId },
      data: { userId, dayOfWeek },
    });
  }

  await generateChores();

  revalidatePath("/admin/chores");
  revalidatePath("/chores");
  revalidatePath("/");
}

/** Rename a chore, and bring outstanding tasks along so they read correctly. */
export async function renameChore(id: string, title: string): Promise<void> {
  await requireAdmin();
  const clean = title.trim().slice(0, 80);
  if (clean.length < 2) return;

  const clash = await prisma.chore.findFirst({
    where: { title: clean, NOT: { id } },
  });
  if (clash) return;

  await prisma.chore.update({ where: { id }, data: { title: clean } });
  // Task titles are snapshots taken at generation; refresh the pending ones.
  await prisma.task.updateMany({
    where: { choreId: id, status: "PENDING" },
    data: { title: clean },
  });

  revalidatePath("/admin/chores");
  revalidatePath("/chores");
  revalidatePath("/");
}

/**
 * Create (or reuse) a chore that several people share, each doing their part.
 * It's stored as one assignment per person on the same day; the flag marks it
 * as collaborative and intervalWeeks sets how often it recurs.
 */
export async function addCollaborativeChore(input: {
  title: string;
  userIds: string[];
  dayOfWeek: number;
  intervalWeeks: number;
  startISO?: string;
  effort?: number;
}): Promise<{ error: string | null }> {
  if (!(await isAdmin())) {
    return { error: "Only a parent can change this. Switch profiles first." };
  }

  const title = input.title.trim().slice(0, 80);
  const userIds = [...new Set(input.userIds)].filter(Boolean);
  const dayOfWeek = input.dayOfWeek;
  const intervalWeeks = Math.max(1, Math.min(8, Math.floor(input.intervalWeeks || 1)));
  const startISO =
    input.startISO && /^\d{4}-\d{2}-\d{2}$/.test(input.startISO)
      ? input.startISO
      : todayISO();

  if (title.length < 2) return { error: "Give the chore a name." };
  if (userIds.length < 2) return { error: "Pick at least two people." };
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: "Pick a day." };
  }

  const chore = await prisma.chore.upsert({
    where: { title },
    update: { isCollaborative: true, intervalWeeks, isActive: true, isPool: false, effort: clampEffort(input.effort ?? 3) },
    create: {
      title,
      isCollaborative: true,
      intervalWeeks,
      effort: clampEffort(input.effort ?? 3),
      sortOrder: await prisma.chore.count(),
    },
  });

  const effectiveFrom = toDateColumn(startISO);
  for (const userId of userIds) {
    await prisma.choreAssignment.upsert({
      where: { choreId_userId_dayOfWeek: { choreId: chore.id, userId, dayOfWeek } },
      update: { isActive: true },
      create: { choreId: chore.id, userId, dayOfWeek, effectiveFrom },
    });
  }

  await generateChores();

  revalidatePath("/admin/chores");
  revalidatePath("/chores");
  revalidatePath("/");
  return { error: null };
}
