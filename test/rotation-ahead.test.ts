import { describe, expect, it } from "vitest";
import { rotationStepsAhead } from "@/lib/workouts/core-library";

// Fri 2026-11-27 is "today" in each case.
describe("rotationStepsAhead (v0.815.3)", () => {
  it("is the next workout the week after the one in place was logged", () => {
    // Arms on Saturdays, Dumbbell pump logged Sat Nov 21.
    expect(rotationStepsAhead("2026-11-28", ["2026-11-21"], "2026-11-27")).toBe(1);
    expect(rotationStepsAhead("2026-12-05", ["2026-11-21"], "2026-11-27")).toBe(2);
  });

  it("counts from the next weekday when the one in place isn't done yet", () => {
    // Core on Wednesdays, nothing logged since it went in place.
    expect(rotationStepsAhead("2026-12-02", [], "2026-11-27")).toBe(0);
    expect(rotationStepsAhead("2026-12-09", [], "2026-11-27")).toBe(1);
  });

  it("ignores logs on other weekdays", () => {
    expect(rotationStepsAhead("2026-12-02", ["2026-11-26"], "2026-11-27")).toBe(0);
    expect(rotationStepsAhead("2026-12-02", ["2026-11-25", "2026-11-26"], "2026-11-27")).toBe(1);
  });
});
