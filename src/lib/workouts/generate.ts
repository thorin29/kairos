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
 * Sport calendar events → dashboard prompts. For a given day, any person whose
 * event is of a type flagged "sport workout" (recurring practices included)
 * gets a "did you do it?" prompt — unless they've already logged it (a
 * WorkoutSession linked by sourceEventId) or declined it (a SportSkip). Keyed
 * on the occurrence date, so each day and each person is independent. Nothing
 * is written here; confirming or declining happens through the sport actions.
 */
export type SportPrompt = {
  eventId: string;
  userId: string;
  title: string;
};

export async function pendingSportPrompts(
  dateISO: string = todayISO(),
): Promise<SportPrompt[]> {
  const tz = householdTz();

  const events = await prisma.event.findMany({
    where: {
      eventType: { is: { sportWorkout: true } },
    },
    select: {
      id: true,
      userId: true,
      title: true,
      startsAt: true,
      rrule: true,
      participants: { select: { userId: true } },
    },
  });
  if (events.length === 0) return [];

  const due = events.filter((e) =>
    e.rrule
      ? occurrencesIn(e.startsAt, e.rrule, dateISO, dateISO, tz).length > 0
      : localParts(e.startsAt).iso === dateISO,
  );
  if (due.length === 0) return [];

  const date = toDateColumn(dateISO);
  const ids = due.map((e) => e.id);

  const [done, skipped] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { date, sourceEventId: { in: ids } },
      select: { userId: true, sourceEventId: true },
    }),
    prisma.sportSkip.findMany({
      where: { date, eventId: { in: ids } },
      select: { userId: true, eventId: true },
    }),
  ]);
  const doneSet = new Set(done.map((s) => `${s.userId}|${s.sourceEventId}`));
  const skipSet = new Set(skipped.map((s) => `${s.userId}|${s.eventId}`));

  const prompts: SportPrompt[] = [];
  for (const e of due) {
    // Whoever's going gets asked; with no one listed, it falls back to the
    // owner, so existing single-person events are unchanged.
    const targets = e.participants.length
      ? e.participants.map((p) => p.userId)
      : e.userId
        ? [e.userId]
        : [];
    for (const userId of targets) {
      const key = `${userId}|${e.id}`;
      if (!doneSet.has(key) && !skipSet.has(key)) {
        prompts.push({ eventId: e.id, userId, title: e.title || "Sport" });
      }
    }
  }
  return prompts;
}
