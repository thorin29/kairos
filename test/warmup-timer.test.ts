import { describe, expect, it } from "vitest";
import { warmupAt, warmupIntervals, warmupSchedule, warmupTotal, type WarmupStep } from "@/lib/workouts/warmup-library";
import { guessPattern } from "@/lib/workouts/library";
import { groupHistory, programOn } from "@/lib/workouts/history";
import { dayHeadline, withSection, type DaySection } from "@/lib/workouts/blocks";
import { PROGRAMS, parseScheme, targetsFor, weightForReps } from "@/lib/workouts/programs";

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
    expect(warmupSchedule(warmupIntervals(steps, 1), 0, 2).map((x) => x.seconds)).toEqual([30, 2, 20, 2, 20]);
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

describe("companion weights", () => {
  const program = PROGRAMS[0];
  const heavy = [
    { weight: 95, reps: 5 },
    { weight: 115, reps: 5 },
    { weight: 135, reps: 5 },
    { weight: 155, reps: 3 },
    { weight: 165, reps: 3 },
  ];
  it("a 5 × 10 after heavy triples is a weight for 10, not the top triple", () => {
    expect(weightForReps(heavy, 10, "lb")).toBe(125);
    const t = targetsFor({ program, week: 1, scheme: parseScheme("same:5x10")!, unit: "lb", last: heavy });
    expect(t.map((x) => x.weight)).toEqual([125, 125, 125, 125, 125]);
  });
  it("keeps the weight already done for the reps; it doesn't step up by itself", () => {
    const done = [10, 10, 10, 10, 10].map((reps) => ({ weight: 130, reps }));
    expect(targetsFor({ program, week: 1, scheme: parseScheme("same:5x10")!, unit: "lb", last: done })[0].weight).toBe(130);
    const missed = [10, 10, 10, 9, 8].map((reps) => ({ weight: 130, reps }));
    expect(targetsFor({ program, week: 1, scheme: parseScheme("same:5x10")!, unit: "lb", last: missed })[0].weight).toBe(130);
  });
});

describe("recent workouts by day", () => {
  const S = (id: string, date: string, label: string, category: string | null, result = "") => ({
    id, date, label, category, result, isRest: false,
  });
  const spans = [
    { name: "5/3/1", startedOn: "2026-11-02", endedOn: "2026-11-03" },
    { name: "5/3/1 BBB", startedOn: "2026-11-03", endedOn: null },
  ];
  it("names the day by its main work and the program it was in, never the warm-up", () => {
    const days = groupHistory(
      [
        S("w", "2026-11-02", "Warm-up", "WARMUP"),
        S("l", "2026-11-02", "Legs", "WEIGHTS", "5 sets · top 225 × 5"),
        S("r", "2026-11-01", "Rowing", "ROWING", "2,000 m"),
        S("x", "2026-10-31", "Warm-up", "WARMUP"),
        S("h", "2026-11-03", "Hockey game", "SPORT"),
        S("b", "2026-11-03", "Back", "WEIGHTS"),
        S("c", "2026-11-03", "Cindy", "HIIT", "12 rounds"),
        S("r2", "2026-11-03", "Rowing", "ROWING"),
      ],
      spans,
    );
    expect(days.map((d) => [d.date, d.label])).toEqual([
      ["2026-11-03", "5/3/1 BBB · Hockey game · Back · Cindy"],
      ["2026-11-02", "5/3/1 · Legs"],
      ["2026-11-01", "Rowing"],
      ["2026-10-31", "Warm-up"],
    ]);
    expect(days[1].ids).toEqual(["w", "l"]);
    expect(days[1].result).toBe("5 sets · top 225 × 5");
  });
  it("finds the program running on a day", () => {
    expect(programOn(spans, "2026-11-01")).toBeNull();
    expect(programOn(spans, "2026-11-02")).toBe("5/3/1");
    expect(programOn(spans, "2026-11-04")).toBe("5/3/1 BBB");
  });
});
