import "server-only";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { loadWorkoutUnitSystem } from "@/lib/queries/workouts";
import { logCardio } from "@/lib/workouts/cardio-run";
import type { TrackIn } from "@/lib/workouts/tracked-shape";

/**
 * A walk, run, ruck or hike tracked in the app (v0.777): logged as a cardio
 * session of its own on the day it started (another workout that day, which
 * finishes the day only when nothing else is planned), with its route kept
 * for Family map History. Sending the same one again changes nothing.
 */
export async function saveTrackedWorkout(
  userId: string,
  t: TrackIn,
): Promise<{ sessionId: string; date: string } | null> {
  const seen = (await prisma.workoutTrack.findUnique({
    where: { clientId: t.clientId },
    select: { userId: true, sessionId: true, startAt: true },
  })) as { userId: string; sessionId: string; startAt: Date } | null;
  if (seen) return seen.userId === userId ? { sessionId: seen.sessionId, date: todayISO(seen.startAt) } : null;

  const date = todayISO(t.startAt);
  const system = await loadWorkoutUnitSystem();
  const distance = t.distanceM > 0 ? t.distanceM / (system === "metric" ? 1000 : 1609.344) : null;
  const sessionId = await logCardio(userId, date, {
    activity: t.activity,
    distance: distance != null ? Math.round(distance * 100) / 100 : null,
    seconds: t.movingSec,
    load: t.load,
  });
  if (!sessionId) return null;
  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: { durationMin: Math.max(1, Math.round(t.movingSec / 60)) },
  });
  await prisma.workoutTrack.create({
    data: {
      sessionId,
      userId,
      clientId: t.clientId,
      activity: t.activity,
      startAt: t.startAt,
      endAt: t.endAt,
      movingSec: t.movingSec,
      distanceM: t.distanceM,
      path: t.path,
    },
  });
  return { sessionId, date };
}
