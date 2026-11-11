import { describe, expect, it } from "vitest";
import {
  buildCardioCharts,
  buildConditioningCharts,
  split,
  type CardioSession,
  type ConditioningSession,
} from "@/lib/workouts/endurance-charts";

const row = (date: string, meters: number, seconds: number, effort: string | null = "SOLID"): CardioSession => ({
  date,
  activity: "ROWING",
  meters,
  distance: null,
  unit: null,
  seconds,
  minutes: Math.round(seconds / 60),
  load: null,
  effort,
});

describe("cardio charts (v0.674)", () => {
  it("adds meters per week, splits per 500 m, the best real effort and the 30-day change", () => {
    const c = buildCardioCharts(
      [
        row("2026-09-20", 2000, 500), // 2:05.0, 31-60 days back
        row("2026-09-25", 2000, 496), // 2:04.0
        row("2026-10-20", 2000, 480), // 2:00.0
        row("2026-11-09", 2000, 472), // 1:58.0
        row("2026-11-10", 500, 100), // 1:40.0, too short to be the best
      ],
      "2026-11-11",
    )!;
    const r = c.activities[0];
    expect(r.measure).toBe("m");
    expect(r.weeks.at(-1)).toEqual({ start: "2026-11-09", value: 2500 });
    expect(r.thisWeek.count).toBe(2);
    expect(r.pace?.best).toEqual({ date: "2026-11-09", sec: 118 });
    expect(r.pace?.change).toBe(-6); // middle of 120, 118, 100 (118) against 124.5
    expect(split(118)).toBe("1:58.0");
    expect(r.recent[0].text).toBe("500 m · 1:40 · Solid");
    expect(c.thisWeek.lines).toEqual([{ label: "Rowing", detail: "2,500 m · 2 sessions" }]);
    expect(r.count).toBe(5);
    expect(r.firstDate).toBe("2026-09-20");
    expect(r.last).toEqual({ date: "2026-11-10", text: "1:40.0 /500 m" });
    expect(r.sinceBestWeeks).toBe(0);
  });

  it("goes by minutes for other cardio and converts km runs to the usual unit", () => {
    const c = buildCardioCharts(
      [
        { date: "2026-11-10", activity: "CARDIO", meters: null, distance: null, unit: null, seconds: null, minutes: 20, load: null, effort: null },
        { date: "2026-11-02", activity: "RUNNING", meters: null, distance: 3, unit: "mi", seconds: 1800, minutes: 30, load: null, effort: "EASY" },
        { date: "2026-11-05", activity: "RUNNING", meters: null, distance: 1.609344, unit: "km", seconds: 540, minutes: 9, load: null, effort: "HARD" },
      ],
      "2026-11-11",
    )!;
    const run = c.activities.find((a) => a.key === "RUNNING")!;
    expect(run.measure).toBe("mi");
    expect(run.pace?.points.map((p) => Math.round(p.sec))).toEqual([600, 540]);
    expect(run.pace?.best?.sec).toBe(540); // 1.61 km is a mile
    const other = c.activities.find((a) => a.key === "CARDIO")!;
    expect(other.pace).toBeNull();
    expect(other.longest).toEqual({ date: "2026-11-10", minutes: 20 });
  });

  it("is null with no cardio", () => {
    expect(buildCardioCharts([], "2026-11-11")).toBeNull();
  });
});

describe("conditioning charts (v0.674)", () => {
  const s = (date: string, name: string, type: ConditioningSession["type"], v: number, version: string | null = null): ConditioningSession => ({
    date,
    name,
    type,
    version,
    reps: type === "FOR_TIME" ? null : v,
    seconds: type === "FOR_TIME" ? v : null,
    minutes: 15,
  });

  it("finds workouts done more than once and their bests", () => {
    const c = buildConditioningCharts(
      [
        s("2026-09-01", "Row and burpee ladder", "FOR_TIME", 900),
        s("2026-10-01", "Row and burpee ladder", "FOR_TIME", 880),
        s("2026-11-03", "Row and burpee ladder", "FOR_TIME", 845),
        s("2026-10-10", "AMRAP 20", "AMRAP", 12),
        s("2026-11-04", "AMRAP 20", "AMRAP", 11),
        s("2026-11-05", "AMRAP 20", "AMRAP", 13, "SCALED"),
      ],
      "2026-11-11",
    )!;
    const ladder = c.repeats.find((r) => r.name === "Row and burpee ladder")!;
    expect(ladder.newBest).toBe(true);
    expect(ladder.last).toBe("14:05");
    expect(ladder.kind).toBe("For time");
    const amrap = c.repeats.find((r) => r.name === "AMRAP 20")!;
    expect(amrap.newBest).toBe(false);
    expect(amrap.best).toBe("12 rounds");
    // Scaled is its own workout, done once.
    expect(c.once).toEqual([{ name: "AMRAP 20", date: "2026-11-05", text: "13 rounds" }]);
    expect(c.newBests30).toBe(1);
    expect(c.month).toEqual({ count: 3, minutes: 45 });
    expect(c.weeks.at(-2)).toEqual({ start: "2026-11-02", count: 3 });
    expect(c.recent[0]).toEqual({ date: "2026-11-05", name: "AMRAP 20", text: "13 rounds" });
    expect(c.recent).toHaveLength(5);
  });
});
