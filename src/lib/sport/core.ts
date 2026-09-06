import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { localParts, toDateColumn } from "@/lib/dates";

/** Gate-free "Yes, I did it" core, shared by the server action and the app API. */
export async function confirmSportCore(
  eventId: string,
  userId: string,
  dateISO: string,
): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, startsAt: true, rrule: true },
  });
  if (!event) return;
  const occurrenceISO = event.rrule ? dateISO : localParts(event.startsAt).iso;
  const date = toDateColumn(occurrenceISO);

  const existing = await prisma.workoutSession.findFirst({
    where: { date, sourceEventId: eventId, userId },
    select: { id: true },
  });
  if (!existing) {
    await prisma.workoutSession.create({
      data: {
        userId,
        date,
        name: (event.title || "Sport").slice(0, 60),
        category: "SPORT",
        finished: true,
        isRest: false,
        sourceEventId: eventId,
      },
    });
  }

  await prisma.sportSkip.deleteMany({ where: { eventId, userId, date } });

  const task = await prisma.task.findFirst({
    where: { userId, category: Category.EXERCISE, dueDate: date },
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

/** Gate-free "No" core: remembered for this person + occurrence. */
export async function declineSportCore(
  eventId: string,
  userId: string,
  dateISO: string,
): Promise<void> {
  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startsAt: true, rrule: true },
  });
  if (!ev) return;
  const occurrenceISO = ev.rrule ? dateISO : localParts(ev.startsAt).iso;
  const date = toDateColumn(occurrenceISO);
  await prisma.sportSkip.upsert({
    where: { eventId_userId_date: { eventId, userId, date } },
    update: {},
    create: { eventId, userId, date },
  });
}
