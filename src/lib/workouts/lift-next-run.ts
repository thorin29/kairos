import "server-only";
import { planDow, swapsFor } from "@/lib/workouts/day-swap-run";
import { planWeekday } from "@/lib/workouts/day-swap";
import { prisma } from "@/lib/prisma";
import { addDays, dayOfWeek, todayISO } from "@/lib/dates";
import { dayPlanWhere, loadMovementLog } from "@/lib/queries/workout-log";

/**
 * A lift's next target (v0.670): the next day in the plan (today through two
 * weeks out) with this movement in it and nothing logged for it yet, and that
 * day's top set as the logger would suggest it. Null when it isn't planned or
 * has no set structure to suggest from.
 */
export async function liftNext(
  userId: string,
  poolExerciseId: string,
): Promise<{ date: string; weight: number; reps: number } | null> {
  const rows = (await prisma.plannedExercise.findMany({
    where: { poolExerciseId, plannedWorkout: { userId, isRest: false } },
    select: { plannedWorkout: { select: { dayOfWeek: true } } },
  })) as { plannedWorkout: { dayOfWeek: number | null } }[];
  const days = new Set(rows.map((r) => r.plannedWorkout.dayOfWeek).filter((d): d is number => d != null));
  if (days.size === 0) return null;
  const today = todayISO();
  const swaps = await swapsFor(userId);
  for (let i = 0; i <= 14; i++) {
    const date = addDays(today, i);
    const dow = planWeekday(swaps, date);
    if (!days.has(dow)) continue;
    const planned = (await prisma.plannedExercise.findFirst({
      where: { poolExerciseId, plannedWorkout: dayPlanWhere(userId, date, dow) },
      select: { id: true },
    })) as { id: string } | null;
    if (!planned) continue;
    const log = await loadMovementLog(userId, date, poolExerciseId);
    if (!log) continue;
    if ((log.sets ?? []).length > 0) continue; // already logged that day
    const sets = (log.target?.sets ?? []).filter((s) => !s.warmup && s.weight != null && s.weight > 0);
    if (sets.length === 0) return null;
    const top = sets.find((s) => s.top) ?? sets.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
    return { date, weight: top.weight as number, reps: top.reps };
  }
  return null;
}
