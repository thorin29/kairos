import { describe, expect, it } from "vitest";
import { isPauseReason, pausedDays } from "@/lib/workouts/pause";

describe("workout pauses (v0.678)", () => {
  it("lists the paused days inside a window", () => {
    const days = pausedDays([{ from: "2026-11-10", to: "2026-11-12" }, { from: "2026-11-20", to: "2026-11-21" }], "2026-11-11", "2026-11-20");
    expect([...days].sort()).toEqual(["2026-11-11", "2026-11-12", "2026-11-20"]);
  });
  it("knows its reasons", () => {
    expect(isPauseReason("SICK")).toBe(true);
    expect(isPauseReason("VACATION")).toBe(false);
  });
});
