import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { isStale, loadStaleContext } from "@/lib/chores/stale";
import { getScoringStart } from "@/lib/settings";

export type PersonScore = {
  id: string;
  name: string;
  color: string;
  completed: number;
  /** Chores that expired unfinished, all time. */
  missed: number;
};

/**
 * Running totals for the weekly scoreboard. Missed counts only chores that
 * actually expired — something still pending and still catchable isn't a
 * miss yet, it's just not done.
 */
export async function loadScores(todayISO: string): Promise<PersonScore[]> {
  const ctx = await loadStaleContext(todayISO);
  const today = toDateColumn(todayISO);

  // Everything before this day stays in the database but stops counting.
  const startISO = await getScoringStart();
  const since = startISO ? { gte: toDateColumn(startISO) } : undefined;

  const [people, completed, pendingChores] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.task.groupBy({
      by: ["userId"],
      where: {
        status: TaskStatus.COMPLETE,
        ...(since ? { dueDate: since } : {}),
      },
      _count: { _all: true },
    }),
    prisma.task.findMany({
      where: {
        status: TaskStatus.PENDING,
        choreId: { not: null },
        dueDate: since ? { lt: today, ...since } : { lt: today },
      },
      select: { userId: true, choreId: true, status: true, dueDate: true },
    }),
  ]);

  const completedBy = new Map(
    completed.map((c) => [c.userId, c._count._all]),
  );

  const missedBy = new Map<string, number>();
  for (const t of pendingChores) {
    if (isStale(t, todayISO, ctx)) {
      missedBy.set(t.userId, (missedBy.get(t.userId) ?? 0) + 1);
    }
  }

  return people.map((p) => ({
    ...p,
    completed: completedBy.get(p.id) ?? 0,
    missed: missedBy.get(p.id) ?? 0,
  }));
}
