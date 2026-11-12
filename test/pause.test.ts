import { describe, expect, it } from "vitest";
import { isPauseReason, pausedDays, fitPause, okPauseRange } from "@/lib/workouts/pause";

describe("workout pauses (v0.678)", () => {
  it("lists the paused days inside a window", () => {
    const days = pausedDays([{ from: "2026-11-10", to: "2026-11-12" }, { from: "2026-11-20", to: "2026-11-21" }], "2026-11-11", "2026-11-20");
    expect([...days].sort()).toEqual(["2026-11-11", "2026-11-12", "2026-11-20"]);
  });
  it("knows its reasons", () => {
    expect(isPauseReason("SICK")).toBe(true);
    expect(isPauseReason("VACATION")).toBe(true);
  });
});

describe("planned pauses (v0.680)", () => {
  it("takes a start from today on and an end on or after it", () => {
    expect(okPauseRange("2026-11-20", "2026-11-27", "2026-11-12")).toEqual({ from: "2026-11-20", to: "2026-11-27" });
    expect(okPauseRange("2026-11-12", "2026-11-12", "2026-11-12")).toEqual({ from: "2026-11-12", to: "2026-11-12" });
    expect(okPauseRange("2026-11-11", "2026-11-20", "2026-11-12")).toBeNull();
    expect(okPauseRange("2026-11-20", "2026-11-19", "2026-11-12")).toBeNull();
    expect(okPauseRange("2027-11-13", "2027-11-14", "2026-11-12")).toBeNull();
    // At most 180 days long.
    expect(okPauseRange("2026-11-12", "2027-12-01", "2026-11-12")?.to).toBe("2027-05-10");
  });

  it("makes room among the person's own pauses", () => {
    const fit = fitPause(
      [
        { id: "inside", from: "2026-11-21", to: "2026-11-22" },
        { id: "before", from: "2026-11-15", to: "2026-11-20" },
        { id: "after", from: "2026-11-25", to: "2026-11-30" },
        { id: "apart", from: "2026-12-10", to: "2026-12-12" },
      ],
      "2026-11-18",
      "2026-11-26",
    );
    expect(fit.remove).toEqual(["inside"]);
    expect(fit.update).toEqual([
      { id: "before", from: "2026-11-15", to: "2026-11-17" },
      { id: "after", from: "2026-11-27", to: "2026-11-30" },
    ]);
    expect(fit.add).toEqual([]);
    const split = fitPause([{ id: "long", from: "2026-11-01", to: "2026-11-30" }], "2026-11-10", "2026-11-12");
    expect(split.update).toEqual([{ id: "long", from: "2026-11-01", to: "2026-11-09" }]);
    expect(split.add).toEqual([{ from: "2026-11-13", to: "2026-11-30", like: "long" }]);
  });
});
