import "server-only";
import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";

const HORIZON_DAYS = 14;

/**
 * Turns the published plan into per-person tasks, the same reconcile-don't-
 * append approach the chores use: work out what should exist in the window,
 * add what's missing, and drop unfinished rows that no longer match.
 *
 * Everyone active gets their own row for the day's passage, so each person
 * checks off their own reading — which is how the household's spreadsheet
 * already worked, a column per reader.
 */
export async function generateReadingTasks(
  fromISO: string = todayISO(),
  days: number = HORIZON_DAYS,
): Promise<{ created: number; removed: number }> {
  const toISO = addDays(fromISO, days - 1);

  // Days from every published plan in the window. More than one plan can be
  // published (a plan queued to start when another ends), so we union their
  // days; on the rare overlap the later-starting plan wins.
  const planDays = await prisma.readingDay.findMany({
    where: {
      plan: { isPublished: true, ownerId: null },
      day: { gte: toDateColumn(fromISO), lte: toDateColumn(toISO) },
    },
    select: {
      day: true,
      passage: true,
      planId: true,
      plan: { select: { startDate: true } },
    },
    orderBy: [{ plan: { startDate: "asc" } }, { day: "asc" }],
  });

  const people = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  // day ISO -> { passage, planId }, later-starting plan overwriting on overlap.
  const byDay = new Map<string, { passage: string; planId: string }>();
  for (const d of planDays) {
    byDay.set(fromDateColumn(d.day), { passage: d.passage, planId: d.planId });
  }

  const expected = new Map<
    string,
    { userId: string; day: string; passage: string; planId: string }
  >();
  for (const [iso, { passage, planId }] of byDay) {
    for (const p of people) {
      expected.set(`${p.id}|${iso}`, { userId: p.id, day: iso, passage, planId });
    }
  }

  const existing = await prisma.task.findMany({
    where: {
      category: Category.BIBLE,
      generatedFrom: { startsWith: "plan:" },
      dueDate: { gte: toDateColumn(fromISO), lte: toDateColumn(toISO) },
    },
    select: {
      id: true,
      userId: true,
      dueDate: true,
      title: true,
      status: true,
    },
  });

  const present = new Set<string>();
  const orphaned: string[] = [];

  for (const t of existing) {
    const iso = fromDateColumn(t.dueDate);
    const key = `${t.userId}|${iso}`;
    const want = expected.get(key);

    // A republished plan can change the passage for a day. An untouched row
    // is replaced; a finished one is left as a record of what was read.
    if (!want || (want.passage !== t.title && t.status === "PENDING")) {
      if (t.status === "PENDING") {
        orphaned.push(t.id);
        continue;
      }
    }

    present.add(key);
  }

  let removed = 0;
  if (orphaned.length > 0) {
    removed = (
      await prisma.task.deleteMany({ where: { id: { in: orphaned } } })
    ).count;
  }

  const missing = [...expected.entries()]
    .filter(([key]) => !present.has(key))
    .map(([, row]) => ({
      userId: row.userId,
      title: row.passage,
      category: Category.BIBLE,
      dueDate: toDateColumn(row.day),
      generatedFrom: `plan:${row.planId}`,
    }));

  let created = 0;
  if (missing.length > 0) {
    created = (
      await prisma.task.createMany({ data: missing, skipDuplicates: true })
    ).count;
  }

  return { created, removed };
}
