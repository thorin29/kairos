import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  dayOfWeek,
  fromDateColumn,
  householdTz,
  localParts,
  toDateColumn,
  todayISO,
} from "@/lib/dates";
import { occurrencesIn } from "@/lib/calendar/recur";

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
    prisma.plannedWorkout.findMany({
      where: { isRest: false },
      select: { userId: true, dayOfWeek: true },
    }),
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

/**
 * Sport calendar events → workouts. For a given day, any person whose event is
 * of a type flagged "sport workout" (including a recurring practice landing on
 * that day) gets a SPORT workout logged, once, linked to the event so it's
 * idempotent. It counts as their workout for the day; if they skipped it, the
 * logged session can be deleted like any other. Runs for the current day.
 */
export async function reconcileSportWorkouts(
  dateISO: string = todayISO(),
): Promise<number> {
  const tz = householdTz();

  const events = await prisma.event.findMany({
    where: {
      userId: { not: null },
      eventType: { is: { sportWorkout: true } },
    },
    select: { id: true, userId: true, title: true, startsAt: true, rrule: true },
  });
  if (events.length === 0) return 0;

  const due = events.filter((e) =>
    e.rrule
      ? occurrencesIn(e.startsAt, e.rrule, dateISO, dateISO, tz).length > 0
      : localParts(e.startsAt).iso === dateISO,
  );
  if (due.length === 0) return 0;

  const date = toDateColumn(dateISO);
  const existing = await prisma.workoutSession.findMany({
    where: { date, sourceEventId: { in: due.map((e) => e.id) } },
    select: { userId: true, sourceEventId: true },
  });
  const have = new Set(existing.map((s) => `${s.userId}|${s.sourceEventId}`));

  const toCreate = due.filter(
    (e) => e.userId && !have.has(`${e.userId}|${e.id}`),
  );
  if (toCreate.length === 0) return 0;

  await prisma.workoutSession.createMany({
    data: toCreate.map((e) => ({
      userId: e.userId as string,
      date,
      name: (e.title || "Sport").slice(0, 60),
      category: "SPORT",
      finished: true,
      isRest: false,
      sourceEventId: e.id,
    })),
  });

  // Mark each affected person's "Worked out?" prompt for the day complete.
  const users = [...new Set(toCreate.map((e) => e.userId as string))];
  for (const userId of users) {
    const t = await prisma.task.findFirst({
      where: { userId, category: Category.EXERCISE, dueDate: date },
    });
    if (t) {
      if (t.status !== "COMPLETE") {
        await prisma.task.update({
          where: { id: t.id },
          data: { status: "COMPLETE", completedAt: new Date() },
        });
      }
    } else {
      await prisma.task.create({
        data: {
          userId,
          category: Category.EXERCISE,
          title: "Workout",
          dueDate: date,
          status: "COMPLETE",
          completedAt: new Date(),
          generatedFrom: `workout:${userId}`,
        },
      });
    }
  }

  return toCreate.length;
}
