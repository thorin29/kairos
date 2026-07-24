import "server-only";
import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateColumn, weekDays } from "@/lib/dates";
import { isStale, loadStaleContext } from "@/lib/chores/stale";

export type ChoreMetrics = {
  userId: string;
  dueThisWeek: number;
  doneThisWeek: number;
  openThisWeek: number;
  missedAllTime: number;
};

/**
 * Household-visible chore numbers. Deliberately separate from the admin
 * screens: everyone can see how the week is going without being able to
 * change what anyone is assigned.
 */
export async function loadChoreMetrics(
  todayISO: string,
): Promise<ChoreMetrics[]> {
  const days = weekDays(todayISO);
  const ctx = await loadStaleContext(todayISO);

  const [week, pending] = await Promise.all([
    prisma.task.findMany({
      where: {
        choreId: { not: null },
        dueDate: {
          gte: toDateColumn(days[0]),
          lte: toDateColumn(days[6]),
        },
      },
      select: { userId: true, status: true },
    }),
    prisma.task.findMany({
      where: {
        choreId: { not: null },
        status: TaskStatus.PENDING,
        dueDate: { lt: toDateColumn(todayISO) },
      },
      select: { userId: true, choreId: true, status: true, dueDate: true },
    }),
  ]);

  const byUser = new Map<string, ChoreMetrics>();

  const get = (userId: string) => {
    let row = byUser.get(userId);
    if (!row) {
      row = {
        userId,
        dueThisWeek: 0,
        doneThisWeek: 0,
        openThisWeek: 0,
        missedAllTime: 0,
      };
      byUser.set(userId, row);
    }
    return row;
  };

  for (const t of week) {
    const row = get(t.userId);
    if (t.status === TaskStatus.SKIPPED) continue;
    row.dueThisWeek += 1;
    if (t.status === TaskStatus.COMPLETE) row.doneThisWeek += 1;
    else row.openThisWeek += 1;
  }

  for (const t of pending) {
    if (isStale(t, todayISO, ctx)) get(t.userId).missedAllTime += 1;
  }

  return [...byUser.values()];
}
