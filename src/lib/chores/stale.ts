import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";

/**
 * A chore's value expires; a school assignment's does not.
 *
 * If Monday's vacuuming never happened and vacuuming comes due again — next
 * Monday, or Wednesday for someone else — the old instance is moot. The
 * floor only needs doing once, and whoever holds the newer one owns it now.
 *
 * Expiry is purely by succession. Nothing expires on a timer: a chore that
 * comes around once a month stays actionable for that whole month.
 *
 * Expired instances grey out, can't be checked off, and never count as
 * complete. The rows stay against their original due date so a missed chore
 * remains a missed chore in the record.
 *
 * Computed at read time rather than written to the row: no nightly sweep,
 * and changing the rule takes effect without a backfill.
 */

export type StaleContext = {
  /** Newest instance of each chore that has already come due. */
  latestDue: Map<string, string>;
};

export async function loadStaleContext(
  todayISO: string,
): Promise<StaleContext> {
  const grouped = await prisma.task.groupBy({
    by: ["choreId"],
    where: { choreId: { not: null }, dueDate: { lte: toDateColumn(todayISO) } },
    _max: { dueDate: true },
  });

  const latestDue = new Map<string, string>();
  for (const g of grouped) {
    if (g.choreId && g._max.dueDate) {
      latestDue.set(g.choreId, fromDateColumn(g._max.dueDate));
    }
  }

  return { latestDue };
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

  const latest = ctx.latestDue.get(task.choreId);
  return Boolean(latest && latest > due);
}
