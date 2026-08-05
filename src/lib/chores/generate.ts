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

// An interval of N means the chore runs one week in every N, counted from the
// assignment's own start date — so picking a start date picks the starting
// week. Every day in the same 7-day step from the anchor shares a phase, and
// co-assignees share a start date, so they always land together.
function weekInPhase(iso: string, intervalWeeks: number, anchorISO: string): boolean {
  const n = Math.max(1, Math.floor(intervalWeeks || 1));
  if (n === 1) return true;
  const days = Math.floor(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${anchorISO}T00:00:00Z`)) /
      86_400_000,
  );
  if (days < 0) return false;
  return Math.floor(days / 7) % n === 0;
}

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
    where: { isActive: true, chore: { isActive: true, isAnytime: false, isPool: false } },
    include: { chore: { select: { title: true, sortOrder: true, intervalWeeks: true } } },
  });

  // Household pauses (vacations) suppress chores for every day they cover, so
  // those days generate nothing and drop out of scoring; chores resume the day
  // after a pause ends.
  const pauses = await prisma.pause.findMany({
    where: {
      startDate: { lte: toDateColumn(toISO) },
      endDate: { gte: toDateColumn(fromISO) },
    },
    select: { startDate: true, endDate: true },
  });
  const pausedDates = new Set<string>();
  for (const p of pauses) {
    let d = fromDateColumn(p.startDate);
    const end = fromDateColumn(p.endDate);
    while (d <= end) {
      pausedDates.add(d);
      d = addDays(d, 1);
    }
  }

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
    if (pausedDates.has(iso)) continue;
    const dow = dayOfWeek(iso);

    for (const a of assignments) {
      if (a.dayOfWeek !== dow) continue;
      if (fromDateColumn(a.effectiveFrom) > iso) continue;
      if (a.effectiveTo && fromDateColumn(a.effectiveTo) < iso) continue;
      if (!weekInPhase(iso, a.chore.intervalWeeks, fromDateColumn(a.effectiveFrom)))
        continue;

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
      // Shared chores have no assignment behind them and run on their own
      // completion cycle, so they must stay out of this reconciliation or
      // they'd be treated as orphans and deleted. "Do anytime" chores run on
      // their own period cycle and are reconciled separately.
      generatedFrom: { not: null },
      chore: { isAnytime: false, isPool: false },
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
