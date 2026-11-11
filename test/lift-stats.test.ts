import { describe, expect, it } from "vitest";
import { estimatedMax, liftTrend, lightWeeks, mondayOf } from "@/lib/workouts/lift-stats";

describe("lift stats", () => {
  it("estimated max from the best set of 12 or fewer, down to a plate step", () => {
    expect(estimatedMax([{ reps: 5, value: 200 }], "lb")).toBe(230); // 233.3
    expect(estimatedMax([{ reps: 1, value: 225 }, { reps: 5, value: 200 }], "lb")).toBe(230);
    expect(estimatedMax([{ reps: 15, value: 100 }], "lb")).toBeNull();
    expect(estimatedMax([{ reps: 3, value: 100 }], "kg")).toBe(110);
    expect(estimatedMax([], "lb")).toBeNull();
  });
  it("trend: climbing over 30 days, else weeks since the best", () => {
    const pts = [
      { date: "2026-09-01", value: 180 },
      { date: "2026-10-01", value: 190 },
      { date: "2026-11-08", value: 200 },
    ];
    expect(liftTrend(pts, { date: "2026-11-08" }, "2026-11-11")).toEqual({ kind: "up", delta: 10 });
    const flat = [
      { date: "2026-09-01", value: 200 },
      { date: "2026-11-08", value: 195 },
    ];
    expect(liftTrend(flat, { date: "2026-09-01" }, "2026-11-11")).toEqual({ kind: "flat", weeks: 10 });
    expect(liftTrend([{ date: "2026-11-08", value: 100 }], { date: "2026-11-08" }, "2026-11-11")).toBeNull();
  });
  it("light weeks by their Monday", () => {
    expect(mondayOf("2026-11-11")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(lightWeeks([{ date: "2026-11-11", intent: "LIGHT" }, { date: "2026-11-12", intent: "LIGHT" }, { date: "2026-11-02" }])).toEqual(["2026-11-09"]);
  });
});
