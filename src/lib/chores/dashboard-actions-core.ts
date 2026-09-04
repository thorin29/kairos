import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";

/**
 * Guard-free cores for the two dashboard chore actions the app can take —
 * claiming an up-for-grabs chore and tapping an always-open chore done. Shared by
 * the web `"use server"` actions (which add the session gate) and the
 * `/api/v1/chores/*` routes (which authenticate the device token and act for that
 * person — "anyone can take these chores" means the enrolled person takes it for
 * themselves). Logic mirrors the originals in actions/tasks.ts + actions/chores.ts.
 */

export type ClaimResult = { error: string | null };

/** Claim an open (up-for-grabs) task for `userId`. Chores only in practice —
 *  only chore-generated tasks are ever released. */
export async function claimTaskCore(
  id: string,
  userId: string,
): Promise<ClaimResult> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return { error: "That task is gone." };
  if (!task.isOpen) return { error: "Someone already picked that up." };

  // The unique index on (chore, person, day) means a person can't hold the same
  // chore twice in a day.
  if (task.choreId) {
    const clash = await prisma.task.findFirst({
      where: {
        choreId: task.choreId,
        userId,
        dueDate: task.dueDate,
        id: { not: id },
      },
    });
    if (clash) return { error: "You already have that chore today." };
  }

  const previousOwner = task.userId;
  await prisma.task.update({
    where: { id },
    data: { userId, isOpen: false },
  });

  revalidatePath("/");
  revalidatePath(`/person/${userId}`);
  revalidatePath(`/person/${previousOwner}`);
  return { error: null };
}

/** Log an always-open chore completion for `userId`, honouring the cooldown. */
export async function completeAlwaysOpenChoreCore(
  choreId: string,
  userId: string,
): Promise<ClaimResult> {
  const chore = await prisma.chore.findUnique({ where: { id: choreId } });
  if (!chore || !chore.alwaysOpen || !chore.isActive || chore.isPaused) {
    return { error: "That chore isn't available." };
  }
  const person = await prisma.user.findUnique({ where: { id: userId } });
  if (!person) return { error: "Whose is this?" };

  if (chore.cooldownMinutes > 0) {
    const last = await prisma.task.findFirst({
      where: { choreId, status: "COMPLETE" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });
    if (last?.completedAt) {
      const readyAt = last.completedAt.getTime() + chore.cooldownMinutes * 60_000;
      if (Date.now() < readyAt) return { error: "It\u2019s not back up yet." };
    }
  }

  const now = new Date();
  const dueDate = toDateColumn(todayISO());
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  let repeatKey = now.getTime() - midnight.getTime();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.task.create({
        data: {
          userId,
          choreId,
          title: chore.title,
          category: "CHORE",
          dueDate,
          completedAt: now,
          status: "COMPLETE",
          sortOrder: chore.sortOrder,
          isOpen: false,
          repeatKey,
        },
      });
      break;
    } catch {
      repeatKey += 1;
      if (attempt === 4) return { error: "Couldn\u2019t log it \u2014 try again." };
    }
  }

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath(`/person/${userId}`);
  return { error: null };
}
