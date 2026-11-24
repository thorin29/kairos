import { describe, expect, it } from "vitest";
import { feltEasy, ladderCheck, lastHeavyWeek, programByKey, waveCheck } from "@/lib/workouts/programs";
import { cleanOtherKind, otherKindOf } from "@/lib/workouts/other-days";

describe("what's next at the end of a cycle (v0.748)", () => {
  it("raises a 5/3/1 lift on 2 or more + set reps and holds it on 1", () => {
    expect(waveCheck(5, 5)).toEqual({ suggest: 5, reason: "+ set: 5 reps" });
    expect(waveCheck(1, 10)).toEqual({ suggest: 0, reason: "+ set: 1 rep" });
    expect(waveCheck(null, 5).suggest).toBe(0);
    expect(waveCheck(4, 5, true).suggest).toBe(0);
  });
  it("raises an Odd squad lift only when every ladder got done", () => {
    expect(ladderCheck(5, 3).suggest).toBe(5);
    expect(ladderCheck(5, 2).suggest).toBe(0);
  });
  it("finds the last heavy week and an easy cycle", () => {
    expect(lastHeavyWeek(programByKey("wendler-531")!)).toBe(3);
    expect(lastHeavyWeek(programByKey("wendler-beginners")!)).toBe(3);
    expect(feltEasy(["EASY", "EASY", "EASY", "EASY", "SOLID"])).toBe(true);
    expect(feltEasy(["EASY", "EASY", "HARD"])).toBe(false);
  });
});

describe("other days (v0.748)", () => {
  const r = (o: object) => ({ category: null, muscleGroup: null, isRest: false, hiitWorkoutId: null, core: null, ...o });
  it("reads what a day holds", () => {
    expect(otherKindOf([])).toBe("skip");
    expect(otherKindOf([r({ isRest: true })])).toBe("rest");
    expect(otherKindOf([r({ category: "WARMUP" }), r({ category: "WEIGHTS", muscleGroup: "ARMS", core: { kind: "arms" } })])).toBe("arms");
    expect(otherKindOf([r({ category: "WEIGHTS", muscleGroup: "CORE", core: { rotation: [] } })])).toBe("core");
    expect(otherKindOf([r({ category: "ISOMETRIC", core: { kind: "iso" } })])).toBe("iso");
    expect(otherKindOf([r({ category: "MOBILITY" })])).toBe("mobility");
    expect(otherKindOf([r({ category: "CARDIO" })])).toBe("cardio");
    expect(otherKindOf([r({ category: "HIIT" })])).toBe("conditioning");
    expect(otherKindOf([r({ category: "WEIGHTS", muscleGroup: "LEGS" })])).toBe("strength:LEGS");
    expect(otherKindOf([r({ category: "WEIGHTS", muscleGroup: "LEGS" }), r({ category: "WEIGHTS", muscleGroup: "BACK" })])).toBe("custom");
  });
  it("keeps only kinds the setup can send", () => {
    expect(cleanOtherKind("core")).toBe("core");
    expect(cleanOtherKind("strength:LEGS")).toBe("strength:LEGS");
    expect(cleanOtherKind("strength")).toBeNull();
    expect(cleanOtherKind("strength:TOES")).toBeNull();
    expect(cleanOtherKind(3)).toBeNull();
  });
});

describe("other days carry their picks (v0.753)", () => {
  it("keeps a picked rotation, routine or movements", async () => {
    const { cleanOtherKind, splitOther } = await import("@/lib/workouts/other-days");
    expect(cleanOtherKind("arms@lib:arms-1,abc|notest")).toBe("arms@lib:arms-1,abc|notest");
    expect(splitOther("arms@lib:arms-1,abc|notest")).toEqual({ kind: "arms", ids: ["lib:arms-1", "abc"], test: false });
    expect(cleanOtherKind("strength:LEGS@p1,p2")).toBe("strength:LEGS@p1,p2");
    expect(cleanOtherKind("mobility@lib:hips")).toBe("mobility@lib:hips");
    expect(cleanOtherKind("core@")).toBe("core");
    expect(cleanOtherKind("rest@x")).toBeNull();
    expect(cleanOtherKind("strength:NOPE@p1")).toBeNull();
    expect(cleanOtherKind("cardio@x")).toBe("cardio");
  });
});

describe("5/3/1 misses and too-hard weeks (v0.754)", () => {
  it("drops on a miss, holds when too hard", async () => {
    const { waveCheck } = await import("@/lib/workouts/programs");
    expect(waveCheck(0, 5, false, { asked: 1, drop: 15 })).toEqual({ suggest: -15, reason: "+ set: 0 reps, missed" });
    expect(waveCheck(4, 5, true, { asked: 1, drop: 15 })).toEqual({ suggest: 0, reason: "+ set: 4 reps, felt too hard" });
    expect(waveCheck(4, 5, false, { asked: 1, drop: 15 })).toEqual({ suggest: 5, reason: "+ set: 4 reps" });
  });
});

describe("5/3/1's 7th week (v0.783)", () => {
  it("adds a deload or test week to the cycle", async () => {
    const { programByKey, withSeventh, weekLabel, weekIntent, programWeek, blocksDone } = await import("@/lib/workouts/programs");
    const base = programByKey("wendler-531")!;
    expect(base.weeks).toBe(3);
    expect(withSeventh(base, null)).toBe(base);
    const d = withSeventh(base, "deload");
    expect(d.weeks).toBe(4);
    expect(weekLabel(d, 4)).toBe("7th week · deload");
    expect(weekIntent(d, 4)).toBe("LIGHT");
    expect(weekLabel(withSeventh(base, "ask"), 4)).toBe("7th week");
    const t = withSeventh(base, "test");
    expect(weekIntent(t, 4)).toBe("TEST");
    expect(t.wave?.[3].at(-1)).toMatchObject({ pct: 1, reps: 3, plus: true });
    // Week 4 of a cycle that started 3 weeks ago, still in it.
    expect(programWeek(d, "2026-11-02", "2026-11-24")).toBe(4);
    expect(blocksDone(d, "2026-11-02", "2026-11-24")).toBe(0);
    expect(blocksDone(base, "2026-11-02", "2026-11-24")).toBe(1);
    // Boring But Big and Beginners are unchanged.
    expect(programByKey("wendler-bbb")?.weeks).toBe(4);
    expect(programByKey("wendler-beginners")?.weeks).toBe(3);
  });
});
