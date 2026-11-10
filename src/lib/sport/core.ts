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

/**
 * Change a calendar-confirmed session afterwards (v0.656): how hard it was
 * (and anything that hurt), and its minutes when the event type's time
 * varies (stick and puck, drop-in) — a game or practice keeps its length.
 */
export async function editSportSessionCore(
  userId: string,
  input: { sessionId: unknown; minutes?: unknown; effort?: unknown; hurt?: unknown },
): Promise<boolean> {
  if (typeof input.sessionId !== "string") return false;
  const s = (await prisma.workoutSession.findFirst({
    where: { id: input.sessionId, userId, sourceEventId: { not: null } },
    select: { id: true, date: true, sourceEventId: true },
  })) as { id: string; date: Date; sourceEventId: string } | null;
  if (!s) return false;
  const m = Number(input.minutes);
  if (input.minutes != null && Number.isFinite(m) && m >= 5 && m <= 600) {
    const ev = (await prisma.event.findUnique({
      where: { id: s.sourceEventId },
      select: { eventType: { select: { sportFlexTime: true } } },
    })) as { eventType: { sportFlexTime: boolean } | null } | null;
    if (ev?.eventType?.sportFlexTime) {
      await prisma.workoutSession.update({ where: { id: s.id }, data: { durationMin: Math.round(m) } });
    }
  }
  if (input.effort !== undefined || input.hurt !== undefined) {
    const effort = typeof input.effort === "string" && input.effort ? input.effort.slice(0, 20) : null;
    const hurt = typeof input.hurt === "string" && input.hurt ? input.hurt.slice(0, 40) : null;
    const slot = `sport:${s.sourceEventId}`;
    await prisma.workoutFeedback.upsert({
      where: { userId_date_slot: { userId, date: s.date, slot } },
      create: { userId, date: s.date, slot, effort, hurt },
      update: { effort, hurt },
    });
  }
  return true;
}
