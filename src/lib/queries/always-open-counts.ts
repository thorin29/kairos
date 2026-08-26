import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn, weekDays } from "@/lib/dates";

export type AlwaysOpenCount = {
  id: string;
  title: string;
  today: number;
  week: number;
};

/**
 * Completion counts for each always-open chore — how many times it's been done
 * today and across this week (household-wide). Always-open taps each write a
 * ChoreLog row, so this is a straight count of those rows per chore. Chores
 * with no completions yet still appear at zero, so the list mirrors what's set
 * up rather than only what's been touched.
 */
export async function loadAlwaysOpenCounts(
  todayISO: string,
): Promise<AlwaysOpenCount[]> {
  const days = weekDays(todayISO);
  const weekStart = toDateColumn(days[0]);
  const weekEnd = toDateColumn(days[6]);
  const todayCol = toDateColumn(todayISO);

  const chores = await prisma.chore.findMany({
    where: { alwaysOpen: true },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
  if (chores.length === 0) return [];

  const ids = chores.map((c) => c.id);

  const [weekRows, todayRows] = await Promise.all([
    prisma.choreLog.groupBy({
      by: ["choreId"],
      where: { choreId: { in: ids }, day: { gte: weekStart, lte: weekEnd } },
      _count: { _all: true },
    }),
    prisma.choreLog.groupBy({
      by: ["choreId"],
      where: { choreId: { in: ids }, day: todayCol },
      _count: { _all: true },
    }),
  ]);

  const weekBy = new Map(weekRows.map((r) => [r.choreId, r._count._all]));
  const todayBy = new Map(todayRows.map((r) => [r.choreId, r._count._all]));

  return chores.map((c) => ({
    id: c.id,
    title: c.title,
    today: todayBy.get(c.id) ?? 0,
    week: weekBy.get(c.id) ?? 0,
  }));
}
