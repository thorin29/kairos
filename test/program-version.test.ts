import { describe, expect, it } from "vitest";
import { cleanVersion, setupDiffers, type ProgramVersion } from "@/lib/workouts/program-version";
import type { CurrentSetup, ProgramChoice } from "@/lib/workouts/program-run";

const role = (key: string, defaultId: string | null, ids: string[], main = false) => ({
  key,
  label: key,
  muscleGroup: "CHEST" as const,
  main,
  optional: !main,
  scheme: "3x10",
  defaultId,
  options: ids.map((id) => ({ id, name: id, best: null })),
});

const CHOICE: ProgramChoice = {
  key: "test-prog",
  name: "Test",
  blurb: "",
  weeks: 4,
  defaultDays: [1, 4],
  days: [
    { name: "A", row: false, roles: [role("bench", "b1", ["b1", "b2"], true), role("fly", "f1", ["f1", "f2"])] },
    { name: "B", row: false, roles: [role("squat", "s1", ["s1"], true), role("extra", null, ["e1"])] },
  ],
};

const base = (): CurrentSetup => ({
  key: "test-prog",
  days: [1, 4],
  picks: { "0:bench": "b1", "0:fly": "f1", "1:squat": "s1", "1:extra": null },
  removed: ["1:extra"],
  schemes: {},
  added: [],
  maxes: { b1: 200, s1: 250 },
});

describe("setupDiffers", () => {
  it("the default setup isn't a version, whatever the maxes", () => {
    expect(setupDiffers(base(), CHOICE)).toBe(false);
    expect(setupDiffers({ ...base(), maxes: { b1: 300 } }, CHOICE)).toBe(false);
  });
  it("a swapped movement, a removed slot, sets, an added lift or other days are", () => {
    expect(setupDiffers({ ...base(), picks: { ...base().picks, "0:fly": "f2" } }, CHOICE)).toBe(true);
    expect(setupDiffers({ ...base(), removed: ["0:fly", "1:extra"] }, CHOICE)).toBe(true);
    expect(setupDiffers({ ...base(), schemes: { "0:fly": "4x8" } }, CHOICE)).toBe(true);
    expect(setupDiffers({ ...base(), added: [{ day: 0, poolExerciseId: "x", scheme: null }] }, CHOICE)).toBe(true);
    expect(setupDiffers({ ...base(), days: [2, 5] }, CHOICE)).toBe(true);
  });
  it("filling a slot that starts empty is", () => {
    expect(setupDiffers({ ...base(), picks: { ...base().picks, "1:extra": "e1" }, removed: [] }, CHOICE)).toBe(true);
  });
});

describe("cleanVersion", () => {
  const extras = { warmup: true, warmupRoutine: null, cardioDays: [3], conditioningDays: [] };
  const v = (setup: CurrentSetup): ProgramVersion => ({ savedOn: "2026-11-01", setup, extras });
  const pool = new Set(["b1", "b2", "f1", "f2", "s1", "e1", "x"]);

  it("keeps a version that still fits", () => {
    const s = { ...base(), picks: { ...base().picks, "0:fly": "f2" }, schemes: { "0:fly": "4x8" } };
    const out = cleanVersion(v(s), CHOICE, pool)!;
    expect(out.setup.picks["0:fly"]).toBe("f2");
    expect(out.setup.schemes).toEqual({ "0:fly": "4x8" });
    expect(out.setup.removed).toEqual(["1:extra"]);
    expect(out.extras).toEqual(extras);
  });
  it("a movement that's gone goes back to the slot's default; a gone added lift is dropped", () => {
    const s = {
      ...base(),
      picks: { ...base().picks, "0:fly": "gone" },
      schemes: { "0:fly": "4x8" },
      added: [
        { day: 0, poolExerciseId: "gone", scheme: null },
        { day: 1, poolExerciseId: "x", scheme: "3x12" },
      ],
      maxes: { b1: 200, gone: 100 },
    };
    const out = cleanVersion(v(s), CHOICE, new Set([...pool].filter((id) => id !== "gone")))!;
    expect(out.setup.picks["0:fly"]).toBe("f1");
    expect(out.setup.schemes).toEqual({});
    expect(out.setup.added).toEqual([{ day: 1, poolExerciseId: "x", scheme: "3x12" }]);
    expect(out.setup.maxes).toEqual({ b1: 200 });
  });
  it("a program whose days changed shape has no version", () => {
    expect(cleanVersion(v({ ...base(), days: [1, 3, 5] }), CHOICE, pool)).toBeNull();
  });
});
