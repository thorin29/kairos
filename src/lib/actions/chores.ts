"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";
import { generateChores } from "@/lib/chores/generate";

export type ChoreActionState = { error: string | null };

/** Master list: the set of jobs that exist, independent of who does them. */
export async function addChore(
  _prev: ChoreActionState,
  formData: FormData,
): Promise<ChoreActionState> {
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
