import { describe, expect, it } from "vitest";
import { freeTimerPlan } from "@/lib/workouts/timer";
import { groupHistory } from "@/lib/workouts/history";
import { warmupSchedule } from "@/lib/workouts/warmup-library";

describe("free Timer (v0.813)", () => {
  it("intervals: work and rest, no rest after the last round", () => {
    const p = freeTimerPlan("INTERVALS", 1, 40, 20, 3);
    expect(p.segments.map((s) => s.sec)).toEqual([40, 20, 40, 20, 40]);
    expect(p.totalSec).toBe(160);
  });
  it("countdown and stopwatch", () => {
    expect(freeTimerPlan("COUNTDOWN", 5, 0, 0, 0).totalSec).toBe(300);
    expect(freeTimerPlan("STOPWATCH", 5, 0, 0, 0).kind).toBe("STOPWATCH");
  });
});

describe("Recent: tracked workouts on their own (v0.813)", () => {
  it("a tracked walk is its own entry beside the day's lift", () => {
    const out = groupHistory(
      [
        { id: "a", date: "2026-11-25", label: "Legs", result: "", isRest: false, category: "WEIGHTS" },
        { id: "b", date: "2026-11-25", label: "Walk", result: "2.1 mi · 45:00", isRest: false, category: "CARDIO", own: true },
      ],
      [],
    );
    expect(out.map((d) => d.label).sort()).toEqual(["Legs", "Walk"]);
  });
});

describe("warm-up: the side pause (v0.813)", () => {
  it("uses the side gap between two sides of one step", () => {
    const s = warmupSchedule(
      [
        { step: 0, name: "Lunge · left", seconds: 30 },
        { step: 0, name: "Lunge · right", seconds: 30 },
        { step: 1, name: "Plank", seconds: 30 },
      ],
      5,
      10,
      3,
    );
    expect(s.filter((x) => x.kind === "READY").map((x) => x.seconds)).toEqual([5, 3, 10]);
  });
});
