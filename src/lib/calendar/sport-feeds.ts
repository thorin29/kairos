import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn, addDays } from "@/lib/dates";

// Look back a few days so a game from yesterday still logs if the tablet
// wasn't opened that day, without retroactively backfilling a whole season
// the moment a feed is flagged.
const WINDOW_DAYS = 3;

/**
 * For every active feed marked "counts as a sport workout" that belongs to a
 * person (family feeds have no single owner to credit), auto-log a SPORT
 * workout on each of its event days in the recent window and tick that day's
 * exercise task — the same effect confirming a sport event has, but automatic.
 * Idempotent: a workout already linked to an event isn't logged twice.
 */
export async function autoLogSportFeeds(today: string): Promise<void> {
  const feeds = await prisma.externalCalendar.findMany({
    where: { isActive: true, sportWorkout: true, userId: { not: null } },
    select: { id: true, userId: true },
  });
  if (feeds.length === 0) return;

  const windowStart = toDateColumn(addDays(today, -WINDOW_DAYS));
  const windowEnd = toDateColumn(addDays(today, 1)); // exclusive upper bound

  for (const feed of feeds) {
    const userId = feed.userId;
    if (!userId) continue;

    const events = await prisma.event.findMany({
      where: {
        externalCalendarId: feed.id,
        cancelled: false,
        startsAt: { gte: windowStart, lt: windowEnd },
      },
      select: { id: true, title: true, startsAt: true },
    });

    for (const ev of events) {
      const dateISO = ev.startsAt.toISOString().slice(0, 10);
      const date = toDateColumn(dateISO);

      const existing = await prisma.workoutSession.findFirst({
        where: { date, sourceEventId: ev.id, userId },
        select: { id: true },
      });
      if (!existing) {
        await prisma.workoutSession.create({
          data: {
            userId,
            date,
            name: (ev.title || "Sport").slice(0, 60),
            category: "SPORT",
            finished: true,
            isRest: false,
            sourceEventId: ev.id,
          },
        });
      }

      // Tick (or create) that day's exercise task, matching the manual path.
      const task = await prisma.task.findFirst({
        where: { userId, category: "EXERCISE", dueDate: date },
        select: { id: true, status: true },
      });
      if (task) {
        if (task.status !== "COMPLETE") {
          await prisma.task.update({
            where: { id: task.id },
            data: { status: "COMPLETE", completedAt: new Date() },
          });
        }
      } else {
        await prisma.task.create({
          data: {
            userId,
            category: "EXERCISE",
            title: "Workout",
            dueDate: date,
            status: "COMPLETE",
            completedAt: new Date(),
            generatedFrom: `workout:${userId}`,
          },
        });
      }
    }
  }
}
