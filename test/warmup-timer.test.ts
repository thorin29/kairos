import { describe, expect, it } from "vitest";
import { warmupAt, warmupIntervals, warmupSchedule, warmupTotal, type WarmupStep } from "@/lib/workouts/warmup-library";
import { guessPattern } from "@/lib/workouts/library";
import { dayHeadline, withSection, type DaySection } from "@/lib/workouts/blocks";

const steps: WarmupStep[] = [
  { name: "Jumping jacks", kind: "REPS", amount: "20" },
  { name: "Front plank", kind: "TIME", seconds: 30 },
  { name: "Side plank", kind: "TIME", seconds: 20, sides: true },
  { name: "Lunges", kind: "REPS", amount: "10", sides: true },
  { name: "Wall sit", kind: "TIME", seconds: 45 },
];

describe("warm-up countdown", () => {
  it("runs the timed steps from one on, both sides of an each-side step", () => {
    expect(warmupIntervals(steps, 1)).toEqual([
      { step: 1, name: "Front plank", seconds: 30 },
      { step: 2, name: "Side plank · left", seconds: 20 },
      { step: 2, name: "Side plank · right", seconds: 20 },
    ]);
    expect(warmupIntervals(steps, 4)).toHaveLength(1);
    expect(warmupIntervals(steps, 0)).toHaveLength(0);
  });
  it("puts get-ready first and the chosen pause between", () => {
    const s = warmupSchedule(warmupIntervals(steps, 1), 5, 10);
    expect(s.map((x) => `${x.kind}${x.seconds}`)).toEqual(["READY5", "WORK30", "READY10", "WORK20", "READY10", "WORK20"]);
    expect(warmupTotal(s)).toBe(95);
    expect(warmupAt(s, 0)).toEqual({ segment: 0, left: 5, done: false });
    expect(warmupAt(s, 5)).toEqual({ segment: 1, left: 30, done: false });
    expect(warmupAt(s, 95).done).toBe(true);
    expect(warmupSchedule(warmupIntervals(steps, 1), 0, 0)).toHaveLength(3);
  });
});

describe("guessPattern", () => {
  it("types a movement by its name", () => {
    expect(guessPattern("Sandbag lunge")).toBe("SQUAT");
    expect(guessPattern("Leg curl")).toBe("HINGE");
    expect(guessPattern("Leg press")).toBe("SQUAT");
    expect(guessPattern("Kettlebell swing")).toBe("HINGE");
    expect(guessPattern("Side plank")).toBe("CORE");
    expect(guessPattern("Barbell row")).toBe("PULL");
    expect(guessPattern("Push-ups")).toBe("PUSH");
    expect(guessPattern("Bicep curl")).toBeNull();
  });
});

describe("day headline", () => {
  const sec = (kind: DaySection["kind"], title: string, n = 1): DaySection => ({
    key: title,
    kind,
    title,
    items: Array.from({ length: n }, () => ({ type: "card" as const, workoutId: title })),
  });
  it("names the kinds of work, not the muscle groups", () => {
    expect(dayHeadline([sec("STRENGTH", "Chest"), sec("STRENGTH", "Legs")])).toBe("Weights");
    expect(dayHeadline([sec("WARMUP", "Warm-up"), sec("CARDIO", "Cardio"), sec("STRENGTH", "Back")])).toBe("Cardio & weights");
    expect(dayHeadline([sec("WARMUP", "Warm-up")])).toBe("Warm-up");
    expect(dayHeadline([sec("CONDITIONING", "Conditioning", 0)])).toBe("");
  });
  it("adds an empty section where the order puts it", () => {
    const s = withSection([sec("CARDIO", "Cardio"), sec("STRENGTH", "Back"), sec("STRETCH", "Stretching")], "CONDITIONING");
    expect(s.map((x) => x.kind)).toEqual(["CARDIO", "STRENGTH", "CONDITIONING", "STRETCH"]);
    const first = withSection([sec("STRENGTH", "Back")], "CONDITIONING", ["CONDITIONING", "WARMUP", "CARDIO", "STRENGTH", "STRETCH", "SPORT"]);
    expect(first[0].kind).toBe("CONDITIONING");
  });
});
