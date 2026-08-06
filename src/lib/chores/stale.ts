import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { daysBetween, fromDateColumn, toDateColumn } from "@/lib/dates";
import { getWorkoutOverdueDays } from "@/lib/settings";

/**
 * A chore's value expires; a school assignment's does not.
 *
 * If Monday's vacuuming never happened and vacuuming comes due again — next
 * Monday, or Wednesday for someone else — the old instance is moot. The
 * floor only needs doing once, and whoever holds the newer one owns it now.
 *
 * For chores this is purely by succession. Nothing expires on a timer: a
 * chore that comes around once a month stays actionable for that whole month.
 *
 * Workout prompts expire on a window instead. Every workout recurs weekly, so
 * a missed one is kept overdue for a configurable number of days (0..6) and
 * then retired. At 6 — the day before the same weekday comes round again —
 * that window coincides with succession, so it lives exactly until it's due
 * again. The window is one admin setting for the whole household.
 *
 * Expired instances grey out, can't be checked off, and never count as
 * complete. The rows stay against their original due date so a missed item
 * remains a miss in the record.
 *
 * Computed at read time rather than written to the row: no nightly sweep,
 * and changing the rule takes effect without a backfill.
 */

export type StaleContext = {
  /** Newest instance of each chore that has already come due. */
  latestDue: Map<string, string>;
  /** Days a workout prompt stays overdue before expiring. */
  workoutOverdueDays: number;
};

export async function loadStaleContext(
  todayISO: string,
): Promise<StaleContext> {
  const [grouped, workoutOverdueDays] = await Promise.all([
    prisma.task.groupBy({
      by: ["choreId"],
      where: {
        choreId: { not: null },
        dueDate: { lte: toDateColumn(todayISO) },
      },
      _max: { dueDate: true },
    }),
    getWorkoutOverdueDays(),
  ]);

  const latestDue = new Map<string, string>();
  for (const g of grouped) {
    if (g.choreId && g._max.dueDate) {
      latestDue.set(g.choreId, fromDateColumn(g._max.dueDate));
    }
  }

  return { latestDue, workoutOverdueDays };
}

export type StaleInput = {
  category: Category;
  choreId: string | null;
  status: TaskStatus;
  dueDate: Date;
};

export function isStale(
  task: StaleInput,
  todayISO: string,
  ctx: StaleContext,
): boolean {
  if (task.status !== TaskStatus.PENDING) return false;

  const due = fromDateColumn(task.dueDate);
  if (due >= todayISO) return false;

  // Workout prompts expire on a fixed overdue window, capped at the weekly
  // cadence (the day before the same weekday's workout comes due again).
  if (task.category === Category.EXERCISE) {
    return daysBetween(due, todayISO) > ctx.workoutOverdueDays;
  }

  // Chores expire the moment the same chore next comes due for anyone.
  if (!task.choreId) return false;
  const latest = ctx.latestDue.get(task.choreId);
  return Boolean(latest && latest > due);
}
