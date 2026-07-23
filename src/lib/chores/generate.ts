import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, toDateColumn, todayISO } from "@/lib/dates";

const HORIZON_DAYS = 14;

/**
 * Materializes Task rows from chore assignments for a window of days.
 *
 * Safe to call on every page load: the unique index on
 * (choreId, userId, dueDate) means a repeat run creates nothing new, and
 * skipDuplicates keeps it to a single round trip.
 *
 * Editing an assignment only affects days not yet generated. Completed and
 * in-flight tasks are never rewritten.
 */
export async function generateChores(
  fromISO: string = todayISO(),
  days: number = HORIZON_DAYS,
): Promise<number> {
  const assignments = await prisma.choreAssignment.findMany({
    where: { isActive: true, chore: { isActive: true } },
    include: { chore: { select: { title: true, sortOrder: true } } },
  });

  if (assignments.length === 0) return 0;

  const rows = [];

  for (let i = 0; i < days; i++) {
    const iso = addDays(fromISO, i);
    const date = toDateColumn(iso);
    const dow = date.getUTCDay();

    for (const a of assignments) {
      if (a.dayOfWeek !== dow) continue;
      if (a.effectiveFrom > date) continue;
      if (a.effectiveTo && a.effectiveTo < date) continue;

      rows.push({
        userId: a.userId,
        choreId: a.choreId,
        title: a.chore.title,
        category: Category.CHORE,
        dueDate: date,
        sortOrder: a.chore.sortOrder,
        generatedFrom: a.id,
      });
    }
  }

  if (rows.length === 0) return 0;

  const result = await prisma.task.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return result.count;
}
