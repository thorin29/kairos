/**
 * Walks, runs, rucks and hikes tracked in the app (v0.777) on a Family map
 * day. Each replaces the trips Home Assistant recorded in the same time (its
 * own route is the better one) and sits in the timeline by its start. A
 * stop Home Assistant saw during one (a slow walk with the dog) gives way to
 * it too (v0.815.1): trimmed to the time outside the workout, or gone if it
 * was all inside; stops someone added stay. Pure, for the tests.
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
  const shown = workouts.filter((x) => x.path.length >= 2);
  const out: DayItem[] = [];
  for (const it of items) {
    if (inside(it)) continue;
    if (it.kind !== "stop" || it.editId) {
      out.push(it);
      continue;
    }
    // What's left of the stop outside every workout, in order.
    let parts: [number, number][] = [[Date.parse(it.start), Date.parse(it.end)]];
    for (const w of shown) {
      const ws = w.startAt.getTime();
      const we = w.endAt.getTime();
      parts = parts.flatMap(([a, b]): [number, number][] => {
        if (b <= ws || a >= we) return [[a, b]];
        const keep: [number, number][] = [];
        if (a < ws) keep.push([a, ws]);
        if (b > we) keep.push([we, b]);
        return keep;
      });
    }
    for (const [a, b] of parts) {
      out.push({ ...it, start: new Date(a).toISOString(), end: new Date(b).toISOString() });
    }
  }
  for (const w of shown) {
    const leg = workoutLeg(w);
    const at = out.findIndex((it) => Date.parse(it.start) > Date.parse(leg.start));
    if (at < 0) out.push(leg);
    else out.splice(at, 0, leg);
  }
  return out;
}
