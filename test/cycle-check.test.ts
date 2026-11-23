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
