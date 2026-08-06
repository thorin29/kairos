import "server-only";
import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn } from "@/lib/dates";

/**
 * Categories the app schedules for you that a household pause silences —
 * chores and workout prompts. Bible reading keeps going through a break, and
 * hand-added one-offs (appointments, tasks) are left alone.
 */
export const PAUSABLE_CATEGORIES: Category[] = [
  Category.CHORE,
  Category.EXERCISE,
];

/**
 * The set of ISO days covered by a household pause (vacation) within a window.
 * Generators use this to skip paused days: a paused day produces no tasks, so
 * it also drops out of scoring, and the same shape works for chores, workouts,
 * and anything else scheduled by day.
 */
export async function loadPausedDates(
  fromISO: string,
  toISO: string,
): Promise<Set<string>> {
  const pauses = await prisma.pause.findMany({
    where: {
      startDate: { lte: toDateColumn(toISO) },
      endDate: { gte: toDateColumn(fromISO) },
    },
    select: { startDate: true, endDate: true },
  });

  const days = new Set<string>();
  for (const p of pauses) {
    let d = fromDateColumn(p.startDate);
    if (d < fromISO) d = fromISO;
    const end = fromDateColumn(p.endDate);
    const stop = end > toISO ? toISO : end;
    while (d <= stop) {
      days.add(d);
      d = addDays(d, 1);
    }
  }
  return days;
}

export type ActivePause = { name: string; startISO: string; endISO: string };

/**
 * Delete pending scheduled tasks (chores, reading, workouts) that fall on a
 * paused day — including days already in the past within the break, which the
 * generators' forward-only reconciliation never revisits. Completed rows are
 * left untouched so the record stands, and hand-added tasks are never touched.
 * Idempotent: safe to run on every load.
 */
export async function clearPausedTasks(dayISO: string): Promise<number> {
  const paused = await loadPausedDates(addDays(dayISO, -120), addDays(dayISO, 30));
  if (paused.size === 0) return 0;

  const dates = [...paused].map((iso) => toDateColumn(iso));
  const res = await prisma.task.deleteMany({
    where: {
      status: TaskStatus.PENDING,
      category: { in: PAUSABLE_CATEGORIES },
      dueDate: { in: dates },
      // Only sweep generated rows — a hand-added task keeps its place.
      OR: [{ generatedFrom: { not: null } }, { choreId: { not: null } }],
    },
  });
  return res.count;
}

/**
 * The pause covering a given day, if any — for the "we're on a break" banners.
 * Earliest start wins when two overlap, which is a non-issue in practice.
 */
export async function loadActivePause(
  dayISO: string,
): Promise<ActivePause | null> {
  const day = toDateColumn(dayISO);
  const pause = await prisma.pause.findFirst({
    where: { startDate: { lte: day }, endDate: { gte: day } },
    orderBy: { startDate: "asc" },
    select: { name: true, startDate: true, endDate: true },
  });
  if (!pause) return null;
  return {
    name: pause.name,
    startISO: fromDateColumn(pause.startDate),
    endISO: fromDateColumn(pause.endDate),
  };
}
