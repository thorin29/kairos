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
 * Brings generated chore tasks in line with the current assignments for a
 * window of days.
 *
 * This reconciles rather than appends. It works out exactly which
 * (chore, person, day) rows *should* exist in the window, then creates the
 * missing ones and removes any unfinished ones that no longer match. An
 * append-only generator leaves orphans behind whenever an assignment is
 * edited, and nothing ever corrects them.
 *
 * Two things are never touched:
 *
 *  - Anything already COMPLETE or SKIPPED. Reassigning a chore must not
 *    erase credit somebody already earned.
 *  - Anything before today. History stays as it happened, so a missed chore
 *    from last week doesn't disappear when the roster changes.
 *
 * Slots are matched on the assignment they came from, not on who holds them.
 * A chore released and picked up by a sibling still fills its slot, so
 * reconciliation leaves it alone instead of rebuilding it for the original
 * owner and creating a duplicate.
 *
 * Date comparisons are on YYYY-MM-DD strings throughout, since the pg driver
 * returns DATE columns as Date objects whose time component depends on the
 * process timezone.
 */
export async function generateChores(
  fromISO: string = todayISO(),
  days: number = HORIZON_DAYS,
): Promise<{ created: number; removed: number }> {
  const toISO = addDays(fromISO, days - 1);

  const assignments = await prisma.choreAssignment.findMany({
    where: { isActive: true, chore: { isActive: true } },
    include: { chore: { select: { title: true, sortOrder: true } } },
  });

  // What the schedule says should exist across the window.
  const expected = new Map<
    string,
    {
      userId: string;
      choreId: string;
      title: string;
      category: Category;
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
      if (fromDateColumn(a.effectiveFrom) > iso) continue;
      if (a.effectiveTo && fromDateColumn(a.effectiveTo) < iso) continue;

      expected.set(`${a.id}|${iso}`, {
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

  // What actually exists there now.
  const existing = await prisma.task.findMany({
    where: {
      choreId: { not: null },
      dueDate: { gte: toDateColumn(fromISO), lte: toDateColumn(toISO) },
    },
    select: {
      id: true,
      generatedFrom: true,
      dueDate: true,
      status: true,
    },
  });

  const present = new Set<string>();
  const orphaned: string[] = [];

  for (const t of existing) {
    const key = `${t.generatedFrom}|${fromDateColumn(t.dueDate)}`;
    present.add(key);

    if (!expected.has(key) && t.status === "PENDING") {
      orphaned.push(t.id);
    }
  }

  let removed = 0;
  if (orphaned.length > 0) {
    const result = await prisma.task.deleteMany({
      where: { id: { in: orphaned } },
    });
    removed = result.count;
  }

  const missing = [...expected.entries()]
    .filter(([key]) => !present.has(key))
    .map(([, row]) => row);

  let created = 0;
  if (missing.length > 0) {
    const result = await prisma.task.createMany({
      data: missing,
      skipDuplicates: true,
    });
    created = result.count;
  }

  return { created, removed };
}
