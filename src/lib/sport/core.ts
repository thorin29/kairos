import { prisma } from "@/lib/prisma";
import { localParts, toDateColumn } from "@/lib/dates";
import { settleWorkoutTask } from "@/lib/workouts/mark";

/** Gate-free "Yes, I did it" core, shared by the server action and the app API. */
export async function confirmSportCore(
  eventId: string,
  userId: string,
  dateISO: string,
): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, startsAt: true, endsAt: true, rrule: true },
  });
  if (!event) return;
  const occurrenceISO = event.rrule ? dateISO : localParts(event.startsAt).iso;
  const date = toDateColumn(occurrenceISO);

  const existing = await prisma.workoutSession.findFirst({
    where: { date, sourceEventId: eventId, userId },
    select: { id: true },
  });
  if (!existing) {
    // Log the workout for as long as the event actually ran (a 60-minute
    // practice logs 60 minutes), not a placeholder minute.
    const durationMin = Math.max(
      1,
      Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60000),
    );
    await prisma.workoutSession.create({
      data: {
        userId,
        date,
        name: (event.title || "Sport").slice(0, 60),
        category: "SPORT",
        durationMin,
        finished: true,
        isRest: false,
        sourceEventId: eventId,
      },
    });
  }

  await prisma.sportSkip.deleteMany({ where: { eventId, userId, date } });

  // A game is an extra (v0.649): on a planned day the plan decides whether
  // the day is done; on a day with nothing planned, the game completes it.
  await settleWorkoutTask(userId, occurrenceISO, { fallbackComplete: true });
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
