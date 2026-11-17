import { describe, expect, it } from "vitest";
import { ODD_SQUAD, lengthsFor, parseScheme, schemeKey, targetsFor, weekSchemeLabel, type Scheme } from "@/lib/workouts/programs";

const t = (scheme: Scheme, week: number, extra: Partial<Parameters<typeof targetsFor>[0]> = {}) =>
  targetsFor({ program: ODD_SQUAD, week, scheme, unit: "lb", last: [], ...extra });

describe("Odd squad", () => {
  it("stores and reads its block kinds", () => {
    for (const k of ["ladder", "ladder:3", "density:15", "carry", "clubs"]) expect(schemeKey(parseScheme(k)!)).toBe(k);
  });
  it("ladders: 1-2-3 × 3 then 1-2-3-4 × 4, deadlift capped at 3, at the 5-rep weight", () => {
    expect(t({ kind: "LADDER" }, 1, { trainingMax: 185, main: true }).map((s) => s.reps)).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3]);
    expect(t({ kind: "LADDER" }, 4, { trainingMax: 185, main: true })).toHaveLength(16);
    expect(t({ kind: "LADDER", cap: 3 }, 4, { trainingMax: 275, main: true, lower: true })).toHaveLength(12);
    expect(t({ kind: "LADDER" }, 2, { trainingMax: 185, main: true }).every((s) => s.weight === 185)).toBe(true);
    expect(weekSchemeLabel({ kind: "LADDER" }, ODD_SQUAD, 3)).toBe("1-2-3-4 × 3 ladders");
  });
  it("week 5: two easy triples, then a new 5-rep max (deadlift a heavy 3)", () => {
    const w5 = t({ kind: "LADDER" }, 5, { trainingMax: 185, main: true });
    expect(w5.map((s) => [s.weight, s.reps])).toEqual([[150], [150], [190]].map(([w], i) => [w, i < 2 ? 3 : 5]));
    expect(t({ kind: "LADDER", cap: 3 }, 5, { trainingMax: 275, main: true, lower: true }).at(-1)).toMatchObject({ weight: 285, reps: 3 });
  });
  it("density: one set more than last time; 20% over the first time steps up", () => {
    const last = Array.from({ length: 8 }, () => ({ weight: 35, reps: 5 }));
    expect(t({ kind: "DENSITY", minutes: 15 }, 2, { last })).toHaveLength(9);
    const up = t({ kind: "DENSITY", minutes: 15 }, 3, { last, firstTotal: { weight: 35, reps: 30 }, sizes: [26, 35, 44] });
    expect(up[0].weight).toBe(44);
    expect(t({ kind: "DENSITY", minutes: 15 }, 1)).toHaveLength(6);
  });
  it("shuttle carry in garage lengths; holds and clubs", () => {
    expect(lengthsFor(40, 20)).toBe(6);
    expect(lengthsFor(60, 20)).toBe(9);
    expect(t({ kind: "CARRY" }, 3, { last: [{ weight: 60, reps: 6 }], garageFeet: 20 })).toEqual([
      { weight: 60, reps: 9 },
      { weight: 60, reps: 9 },
      { weight: 60, reps: 9 },
    ]);
    expect(t({ kind: "CARRY" }, 5, { last: [{ weight: 60, reps: 6 }], sizes: [60, 80] })[0]).toEqual({ weight: 80, reps: 6 });
    expect(weekSchemeLabel({ kind: "CLUBS" }, ODD_SQUAD, 3)).toBe("One hand · 3 × 8 a side");
  });
  it("only main lifts test in week 5; the rest go light", () => {
    const hold: Scheme = { kind: "HOLD", sets: 3, min: 20, max: 45 };
    expect(t(hold, 5).every((s) => s.seconds != null)).toBe(true);
  });
});
