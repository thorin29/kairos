import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, dayOfWeek, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";

const HORIZON_DAYS = 14;

/**
 * Brings generated EXERCISE tasks in line with the current routine
 * assignments across a window of days. Same reconciling shape as chore
 * generation: work out which (assignment, day) tasks should exist, create the
 * missing ones, and drop unfinished ones that no longer match — never touching
 * anything complete, skipped, or in the past.
 *
 * The task carries the assignment id in generatedFrom; a partial unique index
 * on (generatedFrom, dueDate) makes re-running this safe.
 */
export async function generateExercise(
  fromISO: string = todayISO(),
  days: number = HORIZON_DAYS,
): Promise<{ created: number; removed: number }> {
  const toISO = addDays(fromISO, days - 1);

  const assignments = await prisma.routineAssignment.findMany({
    where: { isActive: true, routine: { isActive: true } },
    include: { routine: { select: { name: true, sortOrder: true } } },
  });

  const expected = new Map<
    string,
    {
      userId: string;
      category: Category;
      title: string;
      dueDate: Date;
      sortOrder: number;
      generatedFrom: string;
    }
  >();

  for (let i = 0; i < days; i++) {
    const iso = addDays(fromISO, i);
    const dow = dayOfWeek(iso);

    for (const a of assignments) {
      if (a.dayOfWeek !== dow) continue;
      expected.set(`${a.id}|${iso}`, {
        userId: a.userId,
        category: Category.EXERCISE,
        title: a.routine.name,
        dueDate: toDateColumn(iso),
        sortOrder: a.routine.sortOrder,
        generatedFrom: a.id,
      });
    }
  }

  const existing = await prisma.task.findMany({
    where: {
      category: Category.EXERCISE,
      generatedFrom: { not: null },
      dueDate: { gte: toDateColumn(fromISO), lte: toDateColumn(toISO) },
    },
    select: { id: true, generatedFrom: true, dueDate: true, status: true },
  });

  const present = new Set<string>();
  const orphaned: string[] = [];

  for (const t of existing) {
    const key = `${t.generatedFrom}|${fromDateColumn(t.dueDate)}`;
    present.add(key);
    if (!expected.has(key) && t.status === "PENDING") orphaned.push(t.id);
  }

  let removed = 0;
  if (orphaned.length > 0) {
    const result = await prisma.task.deleteMany({ where: { id: { in: orphaned } } });
    removed = result.count;
  }

  const missing = [...expected.entries()]
    .filter(([key]) => !present.has(key))
    .map(([, row]) => row);

  let created = 0;
  if (missing.length > 0) {
    const result = await prisma.task.createMany({ data: missing, skipDuplicates: true });
    created = result.count;
  }

  return { created, removed };
}
