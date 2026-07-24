"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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

  const count = await prisma.chore.count();
  await prisma.chore.create({ data: { title, sortOrder: count } });

  revalidatePath("/chores");
  return { error: null };
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

  const count = await prisma.chore.count();
  await prisma.chore.create({
    data: { title, isPool: true, intervalDays, sortOrder: count },
  });

  await generatePoolChores();

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
