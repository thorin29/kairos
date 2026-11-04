import { describe, expect, it } from "vitest";
import { buildHeat, creditFor, levelFor, pftPlankPoints, scoreSets, unweightedDays, type HeatSet } from "@/lib/workouts/heat";

const set = (date: string, weight: number | null, reps: number, extra: Partial<HeatSet> = {}): HeatSet => ({
  date,
  movement: "bench",
  name: "Bench press",
  primary: "CHEST",
  secondary: ["ARMS", "SHOULDERS"],
  weight,
  reps,
  ...extra,
});

describe("heat map credit", () => {
  it("counts by how close a set was to failure", () => {
    expect(creditFor(0)).toBe(1);
    expect(creditFor(5)).toBe(1);
    expect(creditFor(7)).toBe(0.5);
    expect(creditFor(12)).toBe(0);
  });

  it("gives nothing for warm-ups and full credit for the top set", () => {
    // 5/3/1-style day: 40/50/60% warm-ups, then 85% x 5+
    const day = [set("2026-10-01", 90, 5), set("2026-10-01", 110, 5), set("2026-10-01", 135, 3), set("2026-10-01", 190, 6)];
    const s = scoreSets(day);
    expect(s.map((x) => x.credit)).toEqual([0, 0, 0, 1]);
  });

  it("does not let many light sets look like hard work", () => {
    const history = [set("2026-09-01", 200, 5)];
    const light = Array.from({ length: 10 }, () => set("2026-10-01", 105, 10));
    const s = scoreSets([...history, ...light]);
    expect(s.slice(1).every((x) => x.credit === 0)).toBe(true);
  });

  it("lets how it felt override the estimate", () => {
    const history = [set("2026-09-01", 200, 5)];
    const s = scoreSets([...history, set("2026-10-01", 105, 10, { effort: "HARD" }), set("2026-09-01", 200, 5, { effort: "EASY" })]);
    expect(s[1].credit).toBe(1);
    expect(s[2].credit).toBe(0.5);
  });

  it("marks heavy sets", () => {
    const s = scoreSets([set("2026-10-01", 200, 3), set("2026-10-01", 150, 10)]);
    expect(s[0].heavy).toBe(true);
    expect(s[1].heavy).toBe(false);
  });

  it("judges bodyweight sets against the best reps", () => {
    const s = scoreSets([
      set("2026-09-01", null, 30, { movement: "pushup" }),
      set("2026-10-01", null, 27, { movement: "pushup" }),
      set("2026-10-01", null, 12, { movement: "pushup" }),
    ]);
    expect(s[1].credit).toBe(1);
    expect(s[2].credit).toBe(0);
  });
});

describe("heat map ranges", () => {
  it("averages per week, gives assisting muscles half, and reports bests", () => {
    const sets: HeatSet[] = [];
    // Twelve weeks, three hard sets a week.
    for (let w = 0; w < 12; w++) {
      const d = new Date(Date.UTC(2026, 7, 13 + w * 7)).toISOString().slice(0, 10);
      for (let i = 0; i < 3; i++) sets.push(set(d, 180 + w * 5, 5));
    }
    const heat = buildHeat(sets, "2026-11-04", "lb");
    const r = heat.ranges.find((x) => x.key === "12w")!;
    const chest = r.groups.find((g) => g.group === "CHEST")!;
    const arms = r.groups.find((g) => g.group === "ARMS")!;
    expect(chest.perWeek).toBe(3);
    expect(arms.perWeek).toBe(1.5);
    expect(chest.level).toBe(1);
    expect(chest.bests[0]).toMatchObject({ name: "Bench press", kind: "weight", reps: 5, to: 235 });
    expect(chest.bests[0].from).toBeLessThan(235);
    expect(heat.unit).toBe("lb");
  });

  it("levels", () => {
    expect([0, 2, 4, 9.9, 10].map(levelFor)).toEqual([0, 1, 2, 2, 3]);
  });
});

describe("timed holds and core days", () => {
  const hold = (date: string, seconds: number, name = "Plank", extra: Partial<HeatSet> = {}): HeatSet => ({
    date,
    movement: name,
    name,
    primary: "CORE",
    secondary: [],
    weight: null,
    reps: null,
    seconds,
    ...extra,
  });

  it("scores a plank on the PFT table", () => {
    expect(pftPlankPoints(69)).toBeNull();
    expect(pftPlankPoints(70)).toBe(40);
    expect(pftPlankPoints(225)).toBe(100);
    expect(pftPlankPoints(300)).toBe(100);
    expect(pftPlankPoints(150)).toBe(71);
  });

  it("counts a passing plank in full and other holds against the longest", () => {
    const s = scoreSets([
      hold("2026-10-01", 180),
      hold("2026-10-02", 75),
      hold("2026-10-03", 90, "Side plank"),
      hold("2026-10-04", 50, "Side plank"),
      hold("2026-10-05", 30, "Side plank"),
    ]);
    expect(s.map((x) => x.credit)).toEqual([1, 1, 1, 0.5, 0]);
  });

  it("reports the longest hold with PFT points", () => {
    const heat = buildHeat([hold("2026-09-01", 100), hold("2026-11-01", 150)], "2026-11-04");
    const core = heat.ranges.find((r) => r.key === "4w")!.groups.find((g) => g.group === "CORE")!;
    expect(core.bests[0]).toMatchObject({ kind: "time", from: 100, to: 150, pft: 71 });
  });

  it("marks core days, but not from a conditioning workout or a lift", () => {
    const days = unweightedDays([
      hold("2026-11-01", 60),
      hold("2026-11-02", 60, "Plank", { marksDay: false }),
      set("2026-11-03", 185, 5),
    ]);
    expect(days).toEqual([{ date: "2026-11-01", groups: ["CORE"] }]);
  });
});
