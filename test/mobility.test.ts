import { describe, expect, it } from "vitest";
import {
  MOBILITY_LIBRARY,
  MOBILITY_ROUTINES,
  LIBRARY_ROUTINES,
  cleanRoutineKind,
  cleanSteps,
  libraryRoutine,
  pickWarmupId,
  parseWarmupChoice,
} from "@/lib/workouts/warmup-library";
import { blockKind, cleanOrder, isOptionalCategory, isSimpleCategory } from "@/lib/workouts/blocks";

describe("mobility (v0.659)", () => {
  it("has its own library, apart from warm-ups", () => {
    const keys = MOBILITY_LIBRARY.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => k.startsWith("mob-"))).toBe(true);
    expect(MOBILITY_ROUTINES.some((r) => LIBRARY_ROUTINES.some((w) => w.id === r.id))).toBe(false);
    expect(libraryRoutine("lib:mob-hips-hang")?.name).toBe("Hips, hang and squat");
  });
  it("keeps a step's how-to", () => {
    expect(cleanSteps([{ name: "Horse stance", kind: "TIME", seconds: 30, cue: " Toes out " }])).toEqual([
      { name: "Horse stance", kind: "TIME", seconds: 30, cue: "Toes out" },
    ]);
    expect(MOBILITY_LIBRARY.every((r) => r.steps.every((s) => !!s.cue))).toBe(true);
  });
  it("rotates weekly like a warm-up rotation", () => {
    const c = parseWarmupChoice("rot:lib:mob-hip-opener,lib:mob-spine");
    expect(pickWarmupId(c, "2026-11-09", "full")).not.toBe(pickWarmupId(c, "2026-11-16", "full"));
  });
  it("is its own section, done with a tap, and counts toward the day", () => {
    expect(blockKind("MOBILITY", false)).toBe("MOBILITY");
    expect(isSimpleCategory("MOBILITY")).toBe(true);
    expect(isOptionalCategory("MOBILITY")).toBe(false);
    expect(cleanOrder(["SPORT", "WARMUP"])).toContain("MOBILITY");
    expect(cleanRoutineKind("mobility")).toBe("mobility");
    expect(cleanRoutineKind("x")).toBe("warmup");
  });
});

import { STRETCH_LIBRARY, libraryRoutinesOf } from "@/lib/workouts/warmup-library";

describe("stretching (v0.663)", () => {
  it("holds every stretch for at least 30 seconds, with how-to", () => {
    expect(STRETCH_LIBRARY.length).toBe(7);
    for (const r of STRETCH_LIBRARY) {
      expect(r.key.startsWith("str-")).toBe(true);
      for (const s of r.steps) {
        expect(s.kind).toBe("TIME");
        expect(s.seconds ?? 0).toBeGreaterThanOrEqual(30);
        expect(s.cue).toBeTruthy();
      }
    }
    expect(libraryRoutinesOf("stretching").map((r) => r.name)).toContain("Goalie hips");
    expect(cleanRoutineKind("stretching")).toBe("stretching");
    expect(isSimpleCategory("STRETCHING")).toBe(true);
    expect(blockKind("STRETCHING", false)).toBe("STRETCH");
  });
});
