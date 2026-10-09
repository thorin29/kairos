import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn } from "@/lib/dates";

/**
 * Shared by both plan queries — the weekly plan the web renders and the day's
 * plan the phone reads. Kept out of either so there is one implementation of
 * "what is this person's best lift", and so `workouts.ts` and `workout-log.ts`
 * do not have to import each other.
 */

/** The day a session was DONE, which is the day it should be shown under. */
export function doneOn(sess: { date: Date; completedOn?: Date | null }): string {
  return fromDateColumn(sess.completedOn ?? sess.date);
}

export type MovementStats = {
  bestWeight: number;
  /** Reps at the record, when they were recorded. Older sets have none. */
  bestWeightReps: number | null;
  bestOn: string;
  /** Highest rep count logged at any weight, with the weight it was done at. */
  bestReps: number | null;
  bestRepsWeight: number | null;
  /** The day that best rep count was done. Null when no reps are logged. */
  bestRepsOn: string | null;
  lastWeight: number;
  lastReps: number | null;
  lastOn: string;
};

/**
 * Record, best rep count and most recent set, per movement.
 *
 * Dates run through `doneOn`, so a workout caught up on later reports the day it
 * was actually done — the same rule the charts and Recent workouts use.
 */
export async function loadMovementStats(
  userId: string,
  poolExerciseIds: string[],
): Promise<Record<string, MovementStats>> {
  if (poolExerciseIds.length === 0) return {};
  const rows = (await prisma.sessionSet.findMany({
    where: {
      session: { userId },
      poolExerciseId: { in: poolExerciseIds },
      weight: { not: null },
    },
    select: {
      poolExerciseId: true,
      weight: true,
      reps: true,
      session: { select: { date: true, completedOn: true } },
    },
  })) as unknown as {
    poolExerciseId: string | null;
    weight: number | null;
    reps: number | null;
    session: { date: Date; completedOn?: Date | null };
  }[];

  const out: Record<string, MovementStats> = {};
  for (const r of rows) {
    const id = r.poolExerciseId;
    if (!id || r.weight == null) continue;
    const on = doneOn(r.session);
    const cur = out[id];
    if (!cur) {
      out[id] = {
        bestWeight: r.weight,
        bestWeightReps: r.reps,
        bestOn: on,
        bestReps: r.reps,
        bestRepsWeight: r.reps != null ? r.weight : null,
        bestRepsOn: r.reps != null ? on : null,
        lastWeight: r.weight,
        lastReps: r.reps,
        lastOn: on,
      };
      continue;
    }
    // Heavier wins; at equal weight, more reps is the better set.
    if (
      r.weight > cur.bestWeight ||
      (r.weight === cur.bestWeight && (r.reps ?? 0) > (cur.bestWeightReps ?? 0))
    ) {
      cur.bestWeight = r.weight;
      cur.bestWeightReps = r.reps;
      cur.bestOn = on;
    }
    if (r.reps != null && r.reps > (cur.bestReps ?? 0)) {
      cur.bestReps = r.reps;
      cur.bestRepsWeight = r.weight;
      cur.bestRepsOn = on;
    }
    // Ties on the same day go to the later row, which is the later edit.
    if (on >= cur.lastOn) {
      cur.lastWeight = r.weight;
      cur.lastReps = r.reps;
      cur.lastOn = on;
    }
  }
  return out;
}
