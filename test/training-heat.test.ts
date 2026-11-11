import { describe, expect, it } from "vitest";
import { buildTrainingHeat, weekPaused, weekStart, type TrainSet } from "@/lib/workouts/training-heat";

const plus = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** A bench day every Monday from `start` for `weeks`, weight from `w(i)`. */
function bench(start: string, weeks: number, w: (i: number) => number, opts: Partial<TrainSet> = {}): TrainSet[] {
  const out: TrainSet[] = [];
  for (let i = 0; i < weeks; i++) {
    for (let k = 0; k < 3; k++)
      out.push({
        date: plus(start, 7 * i),
        movement: "bench",
        name: "Bench press",
        primary: "CHEST",
        secondary: ["ARMS"],
        weight: w(i),
        reps: 5,
        credit: 1,
        ...opts,
      });
  }
  return out;
}
const level = (h: ReturnType<typeof buildTrainingHeat>, g: string) => h.groups.find((x) => x.group === g)?.level;

describe("training heat (v0.664)", () => {
  it("warms a step a week; the top step needs a recent best", () => {
    const steadyUp = bench("2026-01-05", 8, (i) => 135 + i * 5);
    expect(level(buildTrainingHeat(steadyUp, [], "2026-02-25"), "CHEST")).toBe(5);
    const flat = bench("2026-01-05", 12, () => 135);
    expect(level(buildTrainingHeat(flat, [], "2026-03-25"), "CHEST")).toBe(4);
    // Arms only assist (half credit): 1.5 a week isn't real work.
    expect(level(buildTrainingHeat(flat, [], "2026-03-25"), "ARMS")).toBeUndefined();
  });
  it("cools a step per missed week and turns blue only past neutral after four weeks off", () => {
    const sets = bench("2026-01-05", 8, (i) => 135 + i * 5); // to Feb 23, level 5
    const at = (d: string) => level(buildTrainingHeat(sets, [], d), "CHEST");
    expect(at("2026-03-09")).toBe(4); // one full week missed
    expect(at("2026-04-06")).toBe(0); // five missed
    expect(at("2026-04-13")).toBe(-2 + 1); // six missed: one step into blue
    expect(at("2026-06-15")).toBe(-3);
    const h = buildTrainingHeat(sets, [], "2026-04-13");
    expect(h.groups.find((g) => g.group === "CHEST")?.line).toMatch(/last trained 7 weeks ago/);
  });
  it("comes back two a week to where it was, from grey", () => {
    const sets = [...bench("2026-01-05", 8, (i) => 135 + i * 5), ...bench("2026-06-01", 2, () => 150)];
    // −3 melts to 0, then +2.
    expect(level(buildTrainingHeat(sets, [], "2026-06-08"), "CHEST")).toBe(2);
  });
  it("cools on a real strength loss, not on light weeks", () => {
    const losing = bench("2026-01-05", 10, (i) => (i < 6 ? 135 + i * 5 : 160 - (i - 5) * 12));
    const h = buildTrainingHeat(losing, [], "2026-03-11");
    expect(level(h, "CHEST")).toBeLessThan(4);
    expect(h.groups.find((g) => g.group === "CHEST")?.line).toMatch(/Bench press max down \d+% for \d weeks/);
    const deload = [
      ...bench("2026-01-05", 6, (i) => 135 + i * 5),
      ...bench("2026-02-16", 3, () => 100, { light: true }),
    ];
    expect(level(buildTrainingHeat(deload, [], "2026-03-04"), "CHEST")).toBeGreaterThanOrEqual(4);
  });
  it("pauses change nothing", () => {
    const sets = bench("2026-01-05", 8, (i) => 135 + i * 5);
    const pauses = [{ from: "2026-03-01", to: "2026-04-30" }];
    expect(weekPaused(weekStart("2026-03-10"), pauses)).toBe(true);
    const h = buildTrainingHeat(sets, [], "2026-04-29", pauses);
    expect(h.paused).toBe(true);
    expect(level(h, "CHEST")).toBe(5); // every week since the last workout is paused
  });
  it("endurance from minutes and how hard they felt", () => {
    const games = [0, 1, 2, 3, 4].flatMap((i) => [
      { date: plus("2026-01-05", 7 * i), minutes: 70, effort: "HARD", kind: "hockey" },
      { date: plus("2026-01-07", 7 * i), minutes: 20, effort: "SOLID", kind: "rowing" },
    ]);
    const h = buildTrainingHeat([], games, "2026-02-08");
    // 125 weighted minutes a week: warms to 4; the top step needs 200.
    expect(h.endurance?.level).toBe(4);
    expect(h.endurance?.line).toMatch(/about 125 hard minutes a week · hockey, rowing/);
    const easy = [0, 1, 2].map((i) => ({ date: plus("2026-01-05", 7 * i), minutes: 60, effort: "EASY", kind: "rucking" }));
    expect(buildTrainingHeat([], easy, "2026-01-25").endurance?.level).toBe(0);
  });
});

import { groupsFor } from "@/lib/workouts/involvement";
describe("hinge movements on the body (v0.665)", () => {
  it("a good morning works the lower back (core) and legs", () => {
    const g = groupsFor("Good morning", "LEGS");
    expect(g.primary).toBe("LEGS");
    expect(g.secondary).toEqual(expect.arrayContaining(["CORE", "DEADLIFT"]));
    expect(groupsFor("Weighted back extension", null).primary).toBe("CORE");
  });
});
