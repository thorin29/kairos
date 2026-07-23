"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";
import { generateChores } from "@/lib/chores/generate";

export type ChoreActionState = { error: string | null };

export async function addChore(
  _prev: ChoreActionState,
  formData: FormData,
): Promise<ChoreActionState> {
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const staleAfterDays = Number(formData.get("staleAfterDays") ?? 7);

  if (title.length < 2) return { error: "Give the chore a name." };
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 0) {
    return { error: "Expiry must be a whole number of days, or 0 for never." };
  }

  const existing = await prisma.chore.findUnique({ where: { title } });
  if (existing) return { error: `"${title}" is already on the list.` };

  const count = await prisma.chore.count();
  await prisma.chore.create({
    data: { title, staleAfterDays, sortOrder: count },
  });

  revalidatePath("/chores");
  return { error: null };
}

export async function deleteChore(id: string): Promise<void> {
  // Generated tasks keep their title and history; only the link is cleared.
  await prisma.chore.delete({ where: { id } });
  revalidatePath("/chores");
  revalidatePath("/");
}

/**
 * One person per chore per weekday. Passing an empty userId clears the slot.
 * Existing tasks are left alone — a reassignment applies from today forward,
 * so nobody loses credit for something already done.
 */
export async function setAssignment(
  choreId: string,
  dayOfWeek: number,
  userId: string,
): Promise<void> {
  const today = toDateColumn(todayISO());

  await prisma.choreAssignment.deleteMany({ where: { choreId, dayOfWeek } });

  if (userId) {
    await prisma.choreAssignment.create({
      data: { choreId, dayOfWeek, userId, effectiveFrom: today },
    });
  }

  // Future tasks that no longer match an assignment are dropped; anything
  // already completed or due today stays put.
  await prisma.task.deleteMany({
    where: {
      choreId,
      dueDate: { gt: today },
      status: "PENDING",
    },
  });

  await generateChores();

  revalidatePath("/chores");
  revalidatePath("/");
}
