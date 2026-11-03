import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { loadWorkoutUnitSystem } from "@/lib/queries/workouts";

export type WeeklyActivity = {
  label: string;
  count: number;
  detail: string; // e.g. "4 mi" or "45 min", or "" when just a count
};

const CATEGORY_LABEL: Record<string, string> = {
  CARDIO: "Cardio",
  SPORT: "Sport",
  MOBILITY: "Mobility",
  RECOVERY: "Recovery",
  OTHER: "Other",
};

/**
 * This week's non-weights workouts, grouped for a quick "ran 3× · 4 mi" style
 * readout under the weight graph. Weights live on the graph, so they're left
 * out here. Rowing reads in metres (the rower's unit, v0.621); anything else
 * in the household's distance unit (mi or km, Admin → Units), a run logged in
 * metres converted to it. Otherwise total minutes, otherwise just the count.
 */
export async function loadWeeklyActivity(
  userId: string,
  weekDays: string[],
): Promise<WeeklyActivity[]> {
  if (weekDays.length === 0) return [];
  const system = await loadWorkoutUnitSystem();
  const perUnit = system === "metric" ? 1000 : 1609.34;
  const unit = system === "metric" ? "km" : "mi";
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      isRest: false,
      date: { gte: toDateColumn(weekDays[0]), lte: toDateColumn(weekDays[weekDays.length - 1]) },
      OR: [{ category: { not: "WEIGHTS" } }, { category: null }],
    },
    select: {
      name: true,
      category: true,
      durationMin: true,
      sets: { select: { distance: true, meters: true } },
    },
  });

  const groups = new Map<
    string,
    { count: number; distance: number; meters: number; minutes: number; rowing: boolean }
  >();
  for (const s of sessions) {
    const label =
      s.name?.trim() ||
      (s.category ? CATEGORY_LABEL[s.category] ?? s.category : "Workout");
    const g = groups.get(label) ?? { count: 0, distance: 0, meters: 0, minutes: 0, rowing: true };
    g.count += 1;
    g.minutes += s.durationMin ?? 0;
    if (s.category !== "ROWING") g.rowing = false;
    for (const set of s.sets) {
      g.distance += set.distance ?? 0;
      g.meters += set.meters ?? 0;
    }
    groups.set(label, g);
  }

  return [...groups.entries()]
    .map(([label, g]) => ({
      label,
      count: g.count,
      detail: (() => {
        if (g.rowing && g.meters > 0 && g.distance === 0) return `${Math.round(g.meters).toLocaleString("en-US")} m`;
        const d = g.distance + g.meters / perUnit;
        if (d >= 0.1) return `${Math.round(d * 10) / 10} ${unit}`;
        return g.minutes > 0 ? `${g.minutes} min` : "";
      })(),
    }))
    .sort((a, b) => b.count - a.count);
}
