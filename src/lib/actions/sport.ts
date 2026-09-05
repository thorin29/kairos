"use server";

import { revalidatePath } from "next/cache";
import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { localParts, toDateColumn } from "@/lib/dates";
import { requireInteractive, requireCanActFor } from "@/lib/gate";

/**
 * "Yes, I did it." Logs the SPORT session linked to the event (idempotent),
 * clears any earlier decline, and marks the day's exercise task complete — the
 * same effect the old auto-log had, now on demand and per person.
 */
export async function confirmSportWorkout(
  eventId: string,
  userId: string,
  dateISO: string,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, startsAt: true, rrule: true },
  });
  if (!event) return;

  // Date the session by when the event actually happened, not when it was
  // confirmed: a late Saturday game you tick off Sunday morning still counts for
  // Saturday. (Recurring events are prompted per-occurrence, so the passed date
  // is already the occurrence.)
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

  revalidatePath("/", "layout");
}

/** "No." Remembered for this person + this occurrence so the prompt stops. */
export async function declineSportWorkout(
  eventId: string,
  userId: string,
  dateISO: string,
): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
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
  revalidatePath("/", "layout");
}
