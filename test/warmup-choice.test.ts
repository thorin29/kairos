import { describe, expect, it } from "vitest";
import {
  dayFocus,
  libraryRoutine,
  parseWarmupChoice,
  pickWarmupId,
  warmupChoiceValue,
  weekIndex,
  withShoulderPrep,
  SHOULDER_PREP,
} from "@/lib/workouts/warmup-library";

describe("warm-up choices (v0.655)", () => {
  it("reads and writes the three modes", () => {
    expect(parseWarmupChoice("lib:quick-five")).toEqual({ mode: "one", id: "lib:quick-five" });
    expect(parseWarmupChoice("match")).toEqual({ mode: "match" });
    expect(parseWarmupChoice("rot:a,b")).toEqual({ mode: "rotation", ids: ["a", "b"] });
    expect(warmupChoiceValue({ mode: "rotation", ids: ["a", "b"] })).toBe("rot:a,b");
    expect(parseWarmupChoice(null)).toBeNull();
  });
  it("matches the day's lifts", () => {
    expect(dayFocus(["LEGS"])).toBe("lower");
    expect(dayFocus([null, "DEADLIFT"])).toBe("hinge");
    expect(dayFocus([])).toBe("full");
    expect(pickWarmupId({ mode: "match" }, "2026-11-10", "push")).toBe("lib:upper-push");
    expect(pickWarmupId({ mode: "match" }, "2026-11-10", "hinge")).toBe("lib:deadlift-back");
    const legs = [pickWarmupId({ mode: "match" }, "2026-11-10", "lower"), pickWarmupId({ mode: "match" }, "2026-11-17", "lower")];
    expect(new Set(legs).size).toBe(2); // Squat and legs / Hockey legs, a week apart
  });
  it("steps a rotation once a week", () => {
    const c = { mode: "rotation" as const, ids: ["a", "b", "c"] };
    const w = weekIndex("2026-11-10");
    expect(weekIndex("2026-11-16")).toBe(w + 1);
    expect(pickWarmupId(c, "2026-11-10", "full")).not.toBe(pickWarmupId(c, "2026-11-17", "full"));
  });
  it("adds Shoulder prep on weight days unless the cuff is covered", () => {
    const legs = libraryRoutine("lib:squat-legs")!;
    expect(withShoulderPrep(legs, true)!.steps.slice(-SHOULDER_PREP.length)).toEqual([...SHOULDER_PREP]);
    expect(withShoulderPrep(legs, false)).toBe(legs);
    const mine = { id: "x", name: "Regular", mine: true, steps: [{ name: "Rotator cuff - light weight", kind: "REPS" as const }] };
    expect(withShoulderPrep(mine, true)).toBe(mine);
    expect(withShoulderPrep(null, true)?.name).toBe("Shoulder prep");
  });
});
