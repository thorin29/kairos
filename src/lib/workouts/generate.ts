import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, dayOfWeek, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";

const HORIZON_DAYS = 14;

/**
 * The dashboard's workout task is binary: on a day a person has any scheduled
 * exercise, they get one "Worked out?" task. Logging a session completes it
 * (handled in the log action); this only keeps the pending prompts in line
 * with the schedule, the same reconciling shape as chores.
 *
 * generatedFrom is `workout:<userId>` — one prompt per person per day. Ad-hoc
 * logged days get their own completed task from the log action and are left
 * alone here.
 */
export async function generateWorkoutTasks(
  fromISO: string = todayISO(),
  days: number = HORIZON_DAYS,
): Promise<{ created: number; removed: number }> {
  const toISO = addDays(fromISO, days - 1);

  const [schedules, planned] = await Promise.all([
    prisma.workoutSchedule.findMany({
      where: {
        isActive: true,
        isPaused: false,
        exercise: { isActive: true },
        effectiveFrom: { lte: toDateColumn(toISO) },
        OR: [{ endDate: null }, { endDate: { gte: toDateColumn(fromISO) } }],
      },
      select: {
        userId: true,
        dayOfWeek: true,
        effectiveFrom: true,
        endDate: true,
      },
    }),
    prisma.plannedWorkout.findMany({ select: { userId: true, dayOfWeek: true } }),
  ]);

  // A person trains on a weekday if they have a planned workout for it, or a
  // scheduled exercise still in its date window.
  const trains = new Set<string>();
  for (const w of planned) trains.add(`${w.userId}|${w.dayOfWeek}`);

  const expected = new Map<
    string,
    { userId: string; category: Category; title: string; dueDate: Date; generatedFrom: string }
  >();

  for (let i = 0; i < days; i++) {
    const iso = addDays(fromISO, i);
    const dow = dayOfWeek(iso);

    for (const s of schedules) {
      if (s.dayOfWeek !== dow) continue;
      if (fromDateColumn(s.effectiveFrom) > iso) continue;
      if (s.endDate && fromDateColumn(s.endDate) < iso) continue;

      expected.set(`${s.userId}|${iso}`, {
        userId: s.userId,
        category: Category.EXERCISE,
        title: "Workout",
        dueDate: toDateColumn(iso),
        generatedFrom: `workout:${s.userId}`,
      });
    }

    for (const key of trains) {
      const sep = key.lastIndexOf("|");
      const userId = key.slice(0, sep);
      if (Number(key.slice(sep + 1)) !== dow) continue;
      expected.set(`${userId}|${iso}`, {
        userId,
        category: Category.EXERCISE,
        title: "Workout",
        dueDate: toDateColumn(iso),
        generatedFrom: `workout:${userId}`,
      });
    }
  }

  const existing = await prisma.task.findMany({
    where: {
      category: Category.EXERCISE,
      generatedFrom: { startsWith: "workout:" },
      dueDate: { gte: toDateColumn(fromISO), lte: toDateColumn(toISO) },
    },
    select: { id: true, generatedFrom: true, dueDate: true, status: true },
  });

  const present = new Set<string>();
  const orphaned: string[] = [];
  for (const t of existing) {
    const userId = (t.generatedFrom ?? "").slice("workout:".length);
    const key = `${userId}|${fromDateColumn(t.dueDate)}`;
    present.add(key);
    if (!expected.has(key) && t.status === "PENDING") orphaned.push(t.id);
  }

  let removed = 0;
  if (orphaned.length > 0) {
    removed = (await prisma.task.deleteMany({ where: { id: { in: orphaned } } })).count;
  }

  const missing = [...expected.entries()]
    .filter(([key]) => !present.has(key))
    .map(([, row]) => row);

  let created = 0;
  if (missing.length > 0) {
    created = (await prisma.task.createMany({ data: missing, skipDuplicates: true })).count;
  }

  return { created, removed };
}
