import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";

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
 * out here. Distance sums the logged distance; otherwise falls back to total
 * minutes, otherwise just the count.
 */
export async function loadWeeklyActivity(
  userId: string,
  weekDays: string[],
): Promise<WeeklyActivity[]> {
  if (weekDays.length === 0) return [];
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
    { count: number; distance: number; minutes: number }
  >();
  for (const s of sessions) {
    const label =
      s.name?.trim() ||
      (s.category ? CATEGORY_LABEL[s.category] ?? s.category : "Workout");
    const g = groups.get(label) ?? { count: 0, distance: 0, minutes: 0 };
    g.count += 1;
    g.minutes += s.durationMin ?? 0;
    for (const set of s.sets) {
      g.distance += set.distance ?? 0;
      g.distance += (set.meters ?? 0) / 1609.34;
    }
    groups.set(label, g);
  }

  return [...groups.entries()]
    .map(([label, g]) => ({
      label,
      count: g.count,
      detail:
        g.distance >= 0.1
          ? `${Math.round(g.distance * 10) / 10} mi`
          : g.minutes > 0
            ? `${g.minutes} min`
            : "",
    }))
    .sort((a, b) => b.count - a.count);
}
