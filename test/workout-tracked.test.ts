import { describe, expect, it } from "vitest";
import { MAX_PATH_POINTS, parseTrack } from "@/lib/workouts/tracked-shape";
import { withWorkouts } from "@/lib/places/workout-legs";
import type { DayItem } from "@/lib/places/history-types";

const S = Date.UTC(2026, 10, 23, 13, 0);
const iso = (min: number) => new Date(S + min * 60_000).toISOString();
const body = (extra: Record<string, unknown> = {}) => ({
  clientId: "abc12345-run",
  activity: "run",
  startAt: iso(0),
  endAt: iso(30),
  movingSec: 1700,
  distanceM: 5000,
  path: [
    [10, 20, S],
    [10.01, 20, S + 600_000],
    [10.02, 20, S + 1_200_000],
  ],
  ...extra,
});

describe("parseTrack", () => {
  it("accepts a run", () => {
    const t = parseTrack(body());
    expect(t?.activity).toBe("run");
    expect(t?.path).toHaveLength(3);
    expect(t?.load).toBeNull();
  });

  it("keeps a pack weight only on a ruck", () => {
    expect(parseTrack(body({ activity: "ruck", load: 35 }))?.load).toBe(35);
    expect(parseTrack(body({ load: 35 }))?.load).toBeNull();
  });

  it("refuses a bike, a backwards time or a moving time longer than the outing", () => {
    expect(parseTrack(body({ activity: "bike" }))).toBeNull();
    expect(parseTrack(body({ endAt: iso(-5) }))).toBeNull();
    expect(parseTrack(body({ movingSec: 4000 }))).toBeNull();
  });

  it("drops bad points and thins a long route", () => {
    const many = Array.from({ length: MAX_PATH_POINTS * 2 }, (_, i) => [10 + i * 1e-5, 20, S + i * 200]);
    const t = parseTrack(body({ path: [[0, 0, S], ["x", 1, S], ...many] }));
    expect(t?.path).toHaveLength(MAX_PATH_POINTS);
    expect(t?.path[0][0]).toBe(10);
    expect(t?.path[t.path.length - 1][2]).toBe(many[many.length - 1][2]);
  });
});

describe("withWorkouts", () => {
  const stop = (n: number, a: number, b: number): DayItem => ({
    kind: "stop", n, start: iso(a), end: iso(b), lat: 10, lng: 20, place: null,
  });
  const leg = (a: number, b: number): DayItem => ({
    kind: "move", motion: "walk", start: iso(a), end: iso(b), path: [[10, 20], [10.01, 20]],
    snapped: false, distanceM: 900, topMph: null, raw: [], times: [],
  });

  it("replaces the trips and stops recorded during the run", () => {
    const items = [stop(1, -60, -1), leg(0, 14), stop(2, 15, 16), leg(16, 30), stop(3, 31, 90)];
    const w = {
      activity: "run",
      startAt: new Date(iso(0)),
      endAt: new Date(iso(30)),
      distanceM: 5000,
      path: [[10, 20, S], [10.02, 20, S + 1_200_000]] as [number, number, number][],
    };
    const out = withWorkouts(items, [w]);
    expect(out.map((i) => (i.kind === "stop" ? "stop" : i.motion))).toEqual(["stop", "workout", "stop"]);
    const run = out[1];
    expect(run.kind !== "stop" && run.activity).toBe("Run");
  });

  const walk = (a: number, b: number) => ({
    activity: "walk",
    startAt: new Date(iso(a)),
    endAt: new Date(iso(b)),
    distanceM: 800,
    path: [[10, 20, S], [10.01, 20, S + 600_000]] as [number, number, number][],
  });

  it("trims a stop that runs into a slow walk (v0.815.1)", () => {
    // Home Assistant kept "home" going 13 minutes into the walk, and saw a
    // stop at a neighbour's while the dog sniffed.
    const items = [stop(1, -60, 13), leg(13, 14), stop(2, 14, 22), leg(22, 23), stop(3, 23, 90)];
    const out = withWorkouts(items, [walk(0, 22)]);
    expect(out.map((i) => i.kind === "stop" ? `stop ${i.start}–${i.end}` : i.motion)).toEqual([
      `stop ${iso(-60)}–${iso(0)}`,
      "workout",
      "walk",
      `stop ${iso(23)}–${iso(90)}`,
    ]);
  });

  it("splits a stop a short walk sat inside, and keeps an added stop", () => {
    const added: DayItem = { ...stop(2, 5, 5), editId: "e1" };
    const out = withWorkouts([stop(1, -60, 90), added], [walk(0, 20)]);
    const stops = out.filter((i) => i.kind === "stop");
    expect(stops.map((i) => [i.start, i.end])).toEqual([
      [iso(-60), iso(0)],
      [iso(20), iso(90)],
      [iso(5), iso(5)],
    ]);
  });
});
