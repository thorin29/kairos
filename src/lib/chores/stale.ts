import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";

/**
 * A chore's value expires; a school assignment's does not.
 *
 * If Monday's vacuuming never happened and vacuuming comes due again, the
 * old instance is moot — the floor only needs doing once, and whoever holds
 * the new one will handle it. Same if it simply sat untouched past its
 * stale window.
 *
 * Stale instances are greyed out and never count as complete. They stay in
 * the record as missed rather than disappearing, so a week of ignored
 * chores still reads as a week of ignored chores.
 *
 * Like overdue, this is computed rather than written to the row. Nothing
 * needs a nightly sweep, and changing the rule never requires a backfill.
 */

export type StaleContext = {
  /** Newest instance of each chore that has already come due. */
  latestDue: Map<string, string>;
  /** Per-chore expiry window in days; 0 disables it. */
  window: Map<string, number>;
};

export async function loadStaleContext(
  todayISO: string,
): Promise<StaleContext> {
  const today = toDateColumn(todayISO);

  const [grouped, chores] = await Promise.all([
    prisma.task.groupBy({
      by: ["choreId"],
      where: { choreId: { not: null }, dueDate: { lte: today } },
      _max: { dueDate: true },
    }),
    prisma.chore.findMany({ select: { id: true, staleAfterDays: true } }),
  ]);

  const latestDue = new Map<string, string>();
  for (const g of grouped) {
    if (g.choreId && g._max.dueDate) {
      latestDue.set(g.choreId, fromDateColumn(g._max.dueDate));
    }
  }

  const window = new Map<string, number>();
  for (const c of chores) window.set(c.id, c.staleAfterDays);

  return { latestDue, window };
}

export type StaleInput = {
  choreId: string | null;
  status: TaskStatus;
  dueDate: Date;
};

export function isStale(
  task: StaleInput,
  todayISO: string,
  ctx: StaleContext,
): boolean {
  if (!task.choreId) return false;
  if (task.status !== TaskStatus.PENDING) return false;

  const due = fromDateColumn(task.dueDate);
  if (due >= todayISO) return false;

  // Superseded: a newer instance of the same chore has already come due.
  const latest = ctx.latestDue.get(task.choreId);
  if (latest && latest > due) return true;

  // Timed out: nobody did it and the window closed.
  const days = ctx.window.get(task.choreId) ?? 7;
  if (days > 0) {
    const age =
      (Date.parse(`${todayISO}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) /
      86_400_000;
    if (age >= days) return true;
  }

  return false;
}
