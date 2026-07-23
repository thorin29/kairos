import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  dayOfWeek,
  fromDateColumn,
  toDateColumn,
  todayISO,
} from "@/lib/dates";

const HORIZON_DAYS = 14;

/**
 * Materializes Task rows from chore assignments for a window of days.
 *
 * Safe to call on every page load: existing rows for the window are read
 * first and only the genuinely missing ones are inserted, so a repeat run is
 * a no-op. This also means the generator self-heals — if a day was ever
 * missed, the next load fills it in.
 *
 * All date comparisons are on YYYY-MM-DD strings. Comparing the Date objects
 * the driver returns is what caused assignments to be skipped on their first
 * effective day.
 *
 * Editing an assignment only affects days not yet generated. Completed and
 * in-flight tasks are never rewritten.
 */
export async function generateChores(
  fromISO: string = todayISO(),
  days: number = HORIZON_DAYS,
): Promise<number> {
  const toISO = addDays(fromISO, days - 1);

  const assignments = await prisma.choreAssignment.findMany({
    where: { isActive: true, chore: { isActive: true } },
    include: { chore: { select: { title: true, sortOrder: true } } },
  });

  if (assignments.length === 0) return 0;

  const existing = await prisma.task.findMany({
    where: {
      choreId: { not: null },
      dueDate: { gte: toDateColumn(fromISO), lte: toDateColumn(toISO) },
    },
    select: { choreId: true, userId: true, dueDate: true },
  });

  const seen = new Set(
    existing.map(
      (t) => `${t.choreId}|${t.userId}|${fromDateColumn(t.dueDate)}`,
    ),
  );

  const rows: {
    userId: string;
    choreId: string;
    title: string;
    category: Category;
    dueDate: Date;
    sortOrder: number;
    generatedFrom: string;
  }[] = [];

  for (let i = 0; i < days; i++) {
    const iso = addDays(fromISO, i);
    const dow = dayOfWeek(iso);

    for (const a of assignments) {
      if (a.dayOfWeek !== dow) continue;

      const from = fromDateColumn(a.effectiveFrom);
      if (from > iso) continue;

      if (a.effectiveTo && fromDateColumn(a.effectiveTo) < iso) continue;

      const key = `${a.choreId}|${a.userId}|${iso}`;
      if (seen.has(key)) continue;
      seen.add(key);

      rows.push({
        userId: a.userId,
        choreId: a.choreId,
        title: a.chore.title,
        category: Category.CHORE,
        dueDate: toDateColumn(iso),
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
