/**
 * Walks, runs, rucks and hikes tracked in the app (v0.777) on a Family map
 * day. Each replaces the trips Home Assistant recorded in the same time (its
 * own route is the better one) and sits in the timeline by its start. Stops
 * are left alone. Pure, for the tests.
 */
import type { DayItem, DayLegItem } from "@/lib/places/history-types";

export type TrackedWorkout = {
  activity: string;
  startAt: Date;
  endAt: Date;
  distanceM: number;
  /** [lat, lng, ms] */
  path: [number, number, number][];
};

const LABELS: Record<string, string> = { walk: "Walk", run: "Run", ruck: "Ruck", hike: "Hike" };

export function workoutLeg(w: TrackedWorkout): DayLegItem {
  return {
    kind: "move",
    motion: "workout",
    activity: LABELS[w.activity] ?? "Workout",
    start: w.startAt.toISOString(),
    end: w.endAt.toISOString(),
    path: w.path.map(([lat, lng]) => [lat, lng]),
    snapped: false,
    distanceM: Math.round(w.distanceM),
    topMph: null,
    raw: w.path.map(([lat, lng]) => [lat, lng]),
    times: w.path.map((p) => p[2]),
  };
}

export function withWorkouts(items: DayItem[], workouts: TrackedWorkout[]): DayItem[] {
  if (workouts.length === 0) return items;
  const inside = (it: DayItem) => {
    if (it.kind === "stop") return false;
    const mid = (Date.parse(it.start) + Date.parse(it.end)) / 2;
    return workouts.some((w) => mid >= w.startAt.getTime() && mid <= w.endAt.getTime());
  };
  const out = items.filter((it) => !inside(it));
  for (const w of workouts.filter((x) => x.path.length >= 2)) {
    const leg = workoutLeg(w);
    const at = out.findIndex((it) => Date.parse(it.start) > Date.parse(leg.start));
    if (at < 0) out.push(leg);
    else out.splice(at, 0, leg);
  }
  return out;
}
