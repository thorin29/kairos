import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { loadWorkoutUnitSystem } from "@/lib/queries/workouts";

/** A walk, run, ruck or hike tracked in the app, or a backpacking trip day (v0.813). */
export type TrackedItem = {
  sessionId: string | null;
  /** walk, run, ruck, hike or backpack. */
  activity: string;
  /** "Walk · 2.1 mi" for the home tile. */
  name: string;
  /** "Walk" */
  label: string;
  /** "2.1 mi", or null with no distance. */
  distance: string | null;
  minutes: number | null;
  /** When it started (ISO), for the day's order; null for a trip day. */
  startAt: string | null;
};

export const TRACK_LABEL: Record<string, string> = { walk: "Walk", run: "Run", ruck: "Ruck", hike: "Hike", backpack: "Backpacking" };

/** How many walks, runs, rucks and hikes tracked in the app (v0.777) and
 *  backpacking trip days logged (v0.778) a day holds: each is a workout of
 *  its own. */
export async function trackedCount(userId: string, dateISO: string): Promise<number> {
  return (await trackedItems(userId, dateISO)).length;
}

/** The day's tracked workouts by what they were and how far (v0.813). */
export async function trackedItems(userId: string, dateISO: string): Promise<TrackedItem[]> {
  const date = toDateColumn(dateISO);
  const [tracks, backpack] = (await Promise.all([
    prisma.workoutTrack.findMany({
      where: { userId, session: { date, isRest: false } },
      orderBy: { startAt: "asc" },
      select: { sessionId: true, activity: true, distanceM: true, movingSec: true, startAt: true },
    }),
    prisma.backpackDay.findMany({
      where: { userId, date, status: "logged", sessionId: { not: null } },
      select: { sessionId: true },
    }),
  ])) as [
    { sessionId: string; activity: string; distanceM: number; movingSec: number; startAt: Date }[],
    { sessionId: string | null }[],
  ];
  const metric = tracks.length > 0 && (await loadWorkoutUnitSystem()) === "metric";
  const out: TrackedItem[] = tracks.map((t) => {
    const label = TRACK_LABEL[t.activity] ?? "Workout";
    const d = t.distanceM / (metric ? 1000 : 1609.344);
    const distance = t.distanceM >= 50 ? `${d >= 10 ? Math.round(d) : Math.round(d * 10) / 10} ${metric ? "km" : "mi"}` : null;
    return {
      sessionId: t.sessionId,
      activity: t.activity,
      label,
      name: distance ? `${label} · ${distance}` : label,
      distance,
      minutes: t.movingSec > 0 ? Math.max(1, Math.round(t.movingSec / 60)) : null,
      startAt: t.startAt.toISOString(),
    };
  });
  for (const b of backpack) {
    out.push({ sessionId: b.sessionId, activity: "backpack", label: "Backpacking", name: "Backpacking", distance: null, minutes: null, startAt: null });
  }
  return out;
}
