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

describe("training heat (v0.689: earned by progress, eases back)", () => {
  const line = (h: ReturnType<typeof buildTrainingHeat>, g: string) => h.groups.find((x) => x.group === g)?.line;
  it("steady weeks are pale yellow; progress over months earns the colour", () => {
    // 8 weeks of quick gains: too soon to judge progress.
    expect(level(buildTrainingHeat(bench("2026-01-05", 8, (i) => 135 + i * 5), [], "2026-02-25"), "CHEST")).toBe(1);
    // A year of the same weight: trained regularly, never more.
    const flat = buildTrainingHeat(bench("2026-01-05", 52, () => 135), [], "2026-12-30");
    expect(level(flat, "CHEST")).toBe(1);
    expect(line(flat, "CHEST")).toBe("trained regularly · about level");
    // Up about 1.2% a week: orange by 4 months, red by about 7.
    const up = bench("2026-01-05", 40, (i) => Math.round(135 * 1.012 ** i));
    expect(level(buildTrainingHeat(up, [], "2026-04-29"), "CHEST")).toBe(3);
    const red = buildTrainingHeat(up, [], "2026-07-29");
    expect(level(red, "CHEST")).toBe(5);
    expect(line(red, "CHEST")).toMatch(/^Bench press up \d+% in 12 weeks · \d+% in 6 months$/);
    expect(red.groups.find((x) => x.group === "CHEST")?.since).toMatch(/^\+\d+% since you started$/);
  });
  it("a plateau eases it back, but not below pale yellow", () => {
    const sets = bench("2026-01-05", 52, (i) => Math.round(135 * 1.012 ** Math.min(i, 28)));
    const at = (d: string) => level(buildTrainingHeat(sets, [], d), "CHEST") ?? 0;
    const peak = at("2026-08-05");
    expect(peak).toBeGreaterThanOrEqual(4);
    expect(at("2026-10-28")).toBeLessThan(peak);
    expect(at("2026-12-30")).toBe(1);
    expect(line(buildTrainingHeat(sets, [], "2026-10-28"), "CHEST")).toBe("level lately · easing");
  });
  it("assisting work counts a quarter and can't make a week alone", () => {
    const flat = bench("2026-01-05", 12, () => 135);
    // Arms only ever assist: half credit, 1.5 a week isn't real work.
    expect(level(buildTrainingHeat(flat, [], "2026-03-25"), "ARMS")).toBeUndefined();
    const curl = (credit: number) =>
      Array.from({ length: 12 }, (_, i) =>
        Array.from({ length: 2 }, () => ({ date: plus("2026-01-07", 7 * i), movement: "curl", name: "Curl", primary: "ARMS", secondary: [], weight: 30, reps: 10, credit })),
      ).flat();
    // Two easy curl sets (1 credit) plus bench (3 × ¼): 1.75, not a trained week.
    expect(level(buildTrainingHeat([...flat, ...curl(0.5)], [], "2026-03-25"), "ARMS")).toBeUndefined();
    expect(level(buildTrainingHeat([...flat, ...curl(1)], [], "2026-03-25"), "ARMS")).toBe(1);
  });
  it("cools a step per missed week and turns blue only past neutral after four weeks off", () => {
    const sets = bench("2026-01-05", 26, (i) => Math.round(135 * 1.012 ** i)); // to Jun 29
    const at = (d: string) => level(buildTrainingHeat(sets, [], d), "CHEST") ?? 0;
    const was = at("2026-07-01");
    expect(was).toBeGreaterThanOrEqual(3);
    expect(at("2026-07-08")).toBe(was); // this week isn't over
    expect(at("2026-07-15")).toBe(was - 1); // one full week missed
    expect(at("2026-07-29")).toBe(Math.max(0, was - 3)); // three missed
    expect(at("2026-08-26")).toBeLessThan(0);
    expect(at("2026-12-30")).toBe(-3);
    expect(line(buildTrainingHeat(sets, [], "2026-08-19"), "CHEST")).toMatch(/last trained 7 weeks ago/);
  });
  it("a real loss shows and cools it a step a week; light weeks don't count", () => {
    const losing = bench("2026-01-05", 30, (i) => (i < 20 ? Math.round(135 * 1.012 ** i) : Math.round(170 - (i - 19) * 4)));
    const h = buildTrainingHeat(losing, [], "2026-07-29");
    expect(level(h, "CHEST")).toBe(1);
    expect(line(h, "CHEST")).toMatch(/^Bench press down \d+% in 12 weeks$/);
    const deload = [...bench("2026-01-05", 20, (i) => Math.round(135 * 1.012 ** i)), ...bench("2026-05-25", 3, () => 100, { light: true })];
    expect(line(buildTrainingHeat(deload, [], "2026-06-10"), "CHEST")).not.toMatch(/down/);
  });
  it("pauses change nothing", () => {
    const sets = bench("2026-01-05", 26, (i) => Math.round(135 * 1.012 ** i));
    const before = level(buildTrainingHeat(sets, [], "2026-07-01"), "CHEST");
    const pauses = [{ from: "2026-07-06", to: "2026-08-30" }];
    expect(weekPaused(weekStart("2026-07-10"), pauses)).toBe(true);
    const h = buildTrainingHeat(sets, [], "2026-08-26", pauses);
    expect(h.paused).toBe(true);
    expect(level(h, "CHEST")).toBe(before);
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

import { groupsFor, shownGroup } from "@/lib/workouts/involvement";
describe("hinge movements on the body (v0.671)", () => {
  it("the hinge family is Deadlift whatever it's filed under; legs assist", () => {
    const gm = groupsFor("Good morning", "LEGS");
    expect(gm.primary).toBe("DEADLIFT");
    expect(gm.secondary).toEqual(["LEGS"]);
    const be = groupsFor("Weighted back extension", "BACK");
    expect(be.primary).toBe("DEADLIFT");
    expect(be.secondary).toEqual(["LEGS"]);
    // Only a bar hanging from the hands works the upper back.
    expect(groupsFor("Deadlift", null).secondary).toEqual(["LEGS", "BACK"]);
    expect(groupsFor("Romanian deadlift", "LEGS").secondary).toEqual(["LEGS", "BACK"]);
    expect(shownGroup("Weighted back extension", "BACK")).toBe("LOWER_BACK");
    expect(shownGroup("Good morning", "LEGS")).toBe("LOWER_BACK");
    expect(shownGroup("Romanian deadlift", "LEGS")).toBe("DEADLIFT");
    expect(shownGroup("Bench press", "CHEST")).toBe("CHEST");
  });
});

describe("sore spots hold the heat map (v0.686)", () => {
  it("a sore group doesn't cool while it heals", () => {
    const sets = bench("2026-01-05", 26, (i) => Math.round(135 * 1.012 ** i)); // to Jun 29
    const before = level(buildTrainingHeat(sets, [], "2026-07-01"), "CHEST");
    const cooled = level(buildTrainingHeat(sets, [], "2026-08-26"), "CHEST") ?? 0;
    const held = { CHEST: [{ from: "2026-07-06", to: "2026-08-30" }] };
    const h = buildTrainingHeat(sets, [], "2026-08-26", [], held);
    expect(level(h, "CHEST")).toBe(before);
    expect(level(h, "CHEST")).toBeGreaterThan(cooled);
    expect(h.groups.find((g) => g.group === "CHEST")?.line).toMatch(/^Sore/);
    // Arms (assisting only) aren't held by a chest hold.
    expect(h.paused).toBe(false);
  });
});

describe("holds aren't judged for decline (v0.687)", () => {
  it("shorter prescribed holds don't cool a trained group", () => {
    // Legs every week: a steady squat plus a hold whose prescribed time drops.
    const sets: TrainSet[] = [];
    for (let i = 0; i < 10; i++) {
      const date = plus("2026-01-05", 7 * i);
      for (let k = 0; k < 3; k++) {
        sets.push({ date, movement: "squat", name: "Back squat", primary: "LEGS", secondary: [], weight: 150, reps: 6, credit: 1 });
        sets.push({ date, movement: "wallsit", name: "Wall sit", primary: "LEGS", secondary: [], weight: null, reps: null, seconds: i < 5 ? 60 : 20, credit: 1 });
      }
    }
    const h = buildTrainingHeat(sets, [], "2026-03-12");
    expect(level(h, "LEGS")).toBe(1);
    expect(h.groups.find((g) => g.group === "LEGS")?.line).not.toMatch(/down/);
  });
});

describe("programs and top-set logs (v0.688)", () => {
  const sq = (date: string, weight: number, reps: number, n = 3): TrainSet[] =>
    Array.from({ length: n }, () => ({ date, movement: "squat", name: "Back squat", primary: "LEGS", secondary: [], weight, reps, credit: 1 }));
  it("a program's lighter weights aren't a loss once it starts", () => {
    // Heavy singles for weeks (one top set a day), then 5/3/1 from a lower training max.
    const before = Array.from({ length: 16 }, (_, i) => sq(plus("2026-07-06", 7 * i), 185, 3, 1)).flat();
    const program = [...sq("2026-11-02", 140, 5), ...sq("2026-11-09", 150, 6)];
    const sets = [...before, ...program];
    const without = buildTrainingHeat(sets, [], "2026-11-12");
    expect(without.groups.find((g) => g.group === "LEGS")?.line).toMatch(/down/);
    const withStart = buildTrainingHeat(sets, [], "2026-11-12", [], {}, ["2026-11-02"]);
    expect(withStart.groups.find((g) => g.group === "LEGS")?.line).not.toMatch(/down/);
    expect(level(withStart, "LEGS")).toBe(1);
  });
  it("a day with only its top set logged still counts as trained", () => {
    const sets = [0, 1, 2, 3, 4, 5].flatMap((i) => sq(plus("2026-10-05", 7 * i), 185, 3, 1));
    const h = buildTrainingHeat(sets, [], "2026-11-12");
    expect(level(h, "LEGS")).toBe(1);
    expect(h.groups.find((g) => g.group === "LEGS")?.line).toBe("trained regularly · about level");
  });
});
