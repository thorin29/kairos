import { describe, expect, it } from "vitest";
import { estimatedMax, liftTrend, lightWeeks, mondayOf, weekDots } from "@/lib/workouts/lift-stats";

describe("lift stats", () => {
  it("estimated max from the best set of 12 or fewer, down to a plate step", () => {
    expect(estimatedMax([{ reps: 5, value: 200 }], "lb")).toBe(230); // 233.3
    expect(estimatedMax([{ reps: 1, value: 225 }, { reps: 5, value: 200 }], "lb")).toBe(230);
    expect(estimatedMax([{ reps: 15, value: 100 }], "lb")).toBeNull();
    expect(estimatedMax([{ reps: 3, value: 100 }], "kg")).toBe(110);
    expect(estimatedMax([], "lb")).toBeNull();
  });
  it("trend: climbing over 30 days, else holding weeks in a row, or last done", () => {
    const pts = [
      { date: "2026-09-01", value: 180 },
      { date: "2026-10-01", value: 190 },
      { date: "2026-11-08", value: 200 },
    ];
    expect(liftTrend(pts, "2026-11-11")).toEqual({ kind: "up", delta: 10 });
    const holding = [
      { date: "2026-09-01", value: 200 },
      { date: "2026-10-27", value: 195 },
      { date: "2026-11-03", value: 195 },
      { date: "2026-11-10", value: 195 },
    ];
    expect(liftTrend(holding, "2026-11-11")).toEqual({ kind: "holding", weeks: 3 });
    expect(liftTrend([{ date: "2026-09-01", value: 200 }], "2026-11-11")).toEqual({ kind: "stopped", weeks: 10 });
    expect(liftTrend([{ date: "2026-11-08", value: 100 }], "2026-11-11")).toBeNull();
  });
  it("week dots: done, light, missed, before the start", () => {
    const pts = [
      { date: "2026-10-27" },
      { date: "2026-11-10", intent: "LIGHT" },
    ];
    expect(weekDots(pts, "2026-11-11", 4)).toEqual([-1, 2, 0, 1]);
  });
  it("light weeks by their Monday", () => {
    expect(mondayOf("2026-11-11")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(lightWeeks([{ date: "2026-11-11", intent: "LIGHT" }, { date: "2026-11-12", intent: "LIGHT" }, { date: "2026-11-02" }])).toEqual(["2026-11-09"]);
  });
});
