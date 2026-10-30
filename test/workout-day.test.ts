import { describe, expect, it } from "vitest";
import { topSet, setsSummary, fmtSet } from "@/lib/workouts/sets";
import { platesFor, PLATE_BY_ID } from "@/lib/workouts/plates";
import { isHoldName, poolMetricFor } from "@/lib/workouts/catalog";
import { repRecords, recordChips, isNewBest, bandPoints, REP_BANDS, weeksInARow } from "@/lib/workouts/records";
import { PROGRAMS, programByKey, parseScheme, schemeKey, programWeek, blocksDone, targetsFor, weekLabel, raisedMaxes, defaultMovement } from "@/lib/workouts/programs";
import {
  daySections,
  dayTitle,
  dayProgress,
  stripState,
  type DayWorkoutIn,
} from "@/lib/workouts/blocks";

describe("topSet", () => {
  it("is the heaviest set, more reps breaking a tie", () => {
    const sets = [
      { weight: 135, reps: 5 },
      { weight: 185, reps: 1 },
      { weight: 175, reps: 3 },
      { weight: 185, reps: 2 },
    ];
    expect(topSet(sets)).toEqual({ weight: 185, reps: 2 });
  });
  it("uses the biggest number for movements without weight", () => {
    expect(topSet([{ reps: 10 }, { reps: 14 }, { reps: 12 }])).toEqual({ reps: 14 });
    expect(topSet([{ seconds: 45 }, { seconds: 60 }])).toEqual({ seconds: 60 });
  });
  it("prefers any weighted set over an unweighted one", () => {
    expect(topSet([{ reps: 20 }, { weight: 10, reps: 5 }])).toEqual({ weight: 10, reps: 5 });
  });
  it("is null for no sets", () => {
    expect(topSet([])).toBeNull();
  });
});

describe("setsSummary", () => {
  it("names a single set as itself", () => {
    expect(setsSummary([{ weight: 185, reps: 5 }], "lb")).toBe("185 × 5");
    expect(setsSummary([{ weight: 185 }], "lb")).toBe("185 lb");
  });
  it("counts several sets and names the top one", () => {
    const sets = [
      { weight: 135, reps: 5 },
      { weight: 155, reps: 5 },
      { weight: 165, reps: 5 },
      { weight: 175, reps: 3 },
      { weight: 185, reps: 1 },
    ];
    expect(setsSummary(sets, "lb")).toBe("5 sets · top 185 × 1");
  });
  it("formats time and reps", () => {
    expect(fmtSet({ seconds: 90 })).toBe("1:30");
    expect(fmtSet({ seconds: 45 })).toBe("45s");
    expect(fmtSet({ reps: 12 })).toBe("12 reps");
    expect(setsSummary([], "lb")).toBe("");
  });
});

describe("platesFor", () => {
  const perSide = (ids: string[]) => ids.reduce((s, id) => s + PLATE_BY_ID[id].weight, 0);
  it("loads the bar to the total, heaviest plates first", () => {
    expect(platesFor(185, 45)).toEqual(["b45", "b25"]);
    expect(platesFor(225, 45)).toEqual(["b45", "b45"]);
    expect(perSide(platesFor(167.5, 45)) * 2 + 45).toBe(167.5);
  });
  it("is empty at or below the bar", () => {
    expect(platesFor(45, 45)).toEqual([]);
    expect(platesFor(30, 45)).toEqual([]);
  });
  it("never goes over the total", () => {
    for (let t = 45; t <= 405; t += 2.5) {
      expect(perSide(platesFor(t, 45)) * 2 + 45).toBeLessThanOrEqual(t + 1e-9);
    }
  });
});

const w = (o: Partial<DayWorkoutIn> & { id: string }): DayWorkoutIn => ({
  name: "Workout",
  category: "WEIGHTS",
  muscleGroup: null,
  isRest: false,
  hasHiit: false,
  movements: [],
  ...o,
});
const mv = (id: string, metric: "WEIGHT" | "REPS" | "DURATION" | "METERS" | null = "WEIGHT", tracked = true) => ({
  poolExerciseId: id,
  name: id,
  tracked,
  metric,
});

describe("daySections", () => {
  it("orders warm-up, cardio, muscle groups, conditioning", () => {
    const s = daySections([
      w({ id: "hiit", category: "HIIT", hasHiit: true }),
      w({ id: "chest", muscleGroup: "CHEST", movements: [mv("bench")] }),
      w({ id: "row", category: "ROWING" }),
      w({ id: "stretch", category: "STRETCHING", movements: [mv("9090", null, false)] }),
      w({ id: "legs", muscleGroup: "LEGS", movements: [mv("squat")] }),
    ]);
    expect(s.map((x) => x.title)).toEqual(["Warm-up", "Cardio", "Chest", "Legs", "Conditioning"]);
    expect(s[0].items).toEqual([{ type: "card", workoutId: "stretch" }]);
    expect(s[2].items[0]).toMatchObject({ type: "movement", poolExerciseId: "bench", metric: "WEIGHT" });
  });

  it("puts two plans for the same muscle group in one section", () => {
    const s = daySections([
      w({ id: "a1", muscleGroup: "ARMS", movements: [mv("cgbp")] }),
      w({ id: "b1", muscleGroup: "BACK", movements: [mv("row")] }),
      w({ id: "a2", muscleGroup: "ARMS", movements: [mv("curl")] }),
    ]);
    expect(s.map((x) => x.title)).toEqual(["Arms", "Back"]);
    expect(s[0].items.map((i) => (i.type === "movement" ? `${i.workoutId}/${i.poolExerciseId}` : ""))).toEqual([
      "a1/cgbp",
      "a2/curl",
    ]);
  });

  it("keeps a workout as one card when a movement can't be logged by sets", () => {
    const s = daySections([w({ id: "x", muscleGroup: "LEGS", movements: [mv("squat"), mv("sled", "METERS")] })]);
    expect(s[0].items).toEqual([{ type: "card", workoutId: "x" }]);
  });

  it("keeps a workout with nothing tracked as one card (it's marked complete)", () => {
    const s = daySections([w({ id: "x", muscleGroup: "CORE", movements: [mv("plank", "DURATION", false)] })]);
    expect(s[0].items).toEqual([{ type: "card", workoutId: "x" }]);
  });

  it("lists untracked movements beside tracked ones", () => {
    const s = daySections([w({ id: "x", muscleGroup: "CORE", movements: [mv("dl"), mv("stretch", null, false)] })]);
    expect(s[0].items.map((i) => i.type)).toEqual(["movement", "untracked"]);
  });

  it("uses the category's metric when the plan didn't set one", () => {
    const s = daySections([w({ id: "x", category: "ISOMETRIC", movements: [mv("plank", null)] })]);
    expect(s[0].items[0]).toMatchObject({ type: "movement", metric: "DURATION" });
  });

  it("drops rest plans", () => {
    expect(daySections([w({ id: "r", isRest: true })])).toEqual([]);
  });
});

describe("dayTitle", () => {
  const sec = (title: string, kind: "STRENGTH" | "CARDIO" = "STRENGTH") => ({ key: title, kind, title, items: [] });
  it("names one, two or several muscle groups", () => {
    expect(dayTitle([sec("Chest")])).toBe("Chest");
    expect(dayTitle([sec("Chest"), sec("Legs")])).toBe("Chest & legs");
    expect(dayTitle([sec("Chest"), sec("Legs"), sec("Arms")])).toBe("Chest · Legs · Arms");
  });
  it("ignores warm-up and cardio when there's strength work", () => {
    expect(dayTitle([sec("Cardio", "CARDIO"), sec("Back")])).toBe("Back");
  });
  it("falls back to the blocks on a day without strength work", () => {
    expect(dayTitle([sec("Cardio", "CARDIO")])).toBe("Cardio");
    expect(dayTitle([])).toBe("");
  });
});

describe("dayProgress", () => {
  it("counts movements and cards, not untracked movements", () => {
    const s = daySections([
      w({ id: "c", muscleGroup: "CHEST", movements: [mv("bench"), mv("db"), mv("fly", null, false)] }),
      w({ id: "r", category: "ROWING" }),
    ]);
    const p = dayProgress(s, (i) => (i.type === "movement" ? i.poolExerciseId === "bench" : true));
    expect(p).toEqual({ done: 2, total: 3 });
  });
});

describe("stripState", () => {
  const today = "2026-10-30";
  const open = new Set(["2026-10-29"]);
  const d = (date: string, task: "PENDING" | "COMPLETE" | "SKIPPED" | null, logged = false, rested = false) => ({
    date,
    task,
    logged,
    rested,
  });
  it("reads each kind of day", () => {
    expect(stripState(d("2026-10-28", "COMPLETE"), today, open)).toBe("done");
    expect(stripState(d("2026-10-28", "SKIPPED"), today, open)).toBe("rest");
    expect(stripState(d("2026-10-28", null, false, true), today, open)).toBe("rest");
    expect(stripState(d("2026-10-29", "PENDING"), today, open)).toBe("open");
    expect(stripState(d("2026-10-29", "PENDING", true), today, open)).toBe("partial");
    expect(stripState(d("2026-10-27", "PENDING"), today, open)).toBe("expired");
    expect(stripState(d(today, "PENDING"), today, open)).toBe("today");
    expect(stripState(d(today, "PENDING", true), today, open)).toBe("partial");
    expect(stripState(d("2026-10-26", null), today, open)).toBe("none");
    expect(stripState(d("2026-10-26", null, true), today, open)).toBe("done");
  });
});

describe("pool movement metric (v0.609)", () => {
  it("knows a hold by its name", () => {
    expect(["Planks", "Side plank", "Wall sit", "Dead hang", "Hollow hold", "L-sit", "Farmer hold"].every(isHoldName)).toBe(true);
    expect(["Bench press", "Threshold run", "Holder squat", "Pull-ups"].some(isHoldName)).toBe(false);
  });
  it("uses the movement's own setting only when the category allows it", () => {
    expect(poolMetricFor("WEIGHTS", "DURATION")).toBe("DURATION");
    expect(poolMetricFor("WEIGHTS", null)).toBe("WEIGHT");
    expect(poolMetricFor("ROWING", "DURATION")).toBe("METERS");
  });
});

describe("records by rep count (v0.610)", () => {
  const hist = [
    { weight: 185, reps: 1, date: "2026-10-05" },
    { weight: 175, reps: 3, date: "2026-10-05" },
    { weight: 165, reps: 5, date: "2026-10-12" },
    { weight: 165, reps: 5, date: "2026-10-01" },
    { weight: 135, reps: 10, date: "2026-09-20" },
    { weight: null, reps: 5, date: "2026-09-01" },
  ];
  it("keeps the heaviest per exact rep count, first day it was done", () => {
    expect(repRecords(hist)).toEqual([
      { reps: 1, weight: 185, date: "2026-10-05" },
      { reps: 3, weight: 175, date: "2026-10-05" },
      { reps: 5, weight: 165, date: "2026-10-01" },
      { reps: 10, weight: 135, date: "2026-09-20" },
    ]);
  });
  it("chips favour the usual counts", () => {
    const recs = repRecords([...hist, { weight: 150, reps: 7, date: "2026-10-02" }, { weight: 120, reps: 12, date: "2026-10-02" }]);
    expect(recordChips(recs).map((r) => r.reps)).toEqual([1, 3, 5, 10]);
  });
  it("a new best is something never matched for as many reps or more", () => {
    const recs = repRecords(hist);
    expect(isNewBest({ weight: 170, reps: 5 }, recs)).toBe(true);
    expect(isNewBest({ weight: 175, reps: 2 }, recs)).toBe(false); // 175 × 3 already
    expect(isNewBest({ weight: 180, reps: 2 }, recs)).toBe(true);
    expect(isNewBest({ weight: 100, reps: 12 }, recs)).toBe(true); // never 12 reps
    expect(isNewBest({ weight: 200, reps: 1 }, [])).toBe(false); // first session ever
  });
  it("rep-range lines take the heaviest set in range per day", () => {
    const band = REP_BANDS.find((b) => b.key === "4-6")!;
    expect(
      bandPoints(
        [
          { weight: 185, reps: 1, date: "2026-10-05" },
          { weight: 165, reps: 5, date: "2026-10-05" },
          { weight: 165, reps: 6, date: "2026-10-05" },
          { weight: 155, reps: 4, date: "2026-10-01" },
        ],
        band,
      ),
    ).toEqual([
      { date: "2026-10-01", value: 155, reps: 4 },
      { date: "2026-10-05", value: 165, reps: 6 },
    ]);
  });
});

describe("weeks in a row (v0.610)", () => {
  const w = (due: number, open: number, logged: boolean, current = false) => ({ start: "", due, open, logged, current });
  it("counts done or excused weeks, newest first, until one wasn't", () => {
    expect(weeksInARow([w(3, 1, true, true), w(5, 0, true), w(5, 0, false), w(5, 2, true), w(5, 0, true)])).toBe(2);
  });
  it("the current week adds once it qualifies and never breaks the run", () => {
    expect(weeksInARow([w(2, 0, true, true), w(5, 0, true)])).toBe(2);
    expect(weeksInARow([w(0, 0, false, true), w(5, 0, true)])).toBe(1);
  });
  it("a week with nothing due and nothing logged ends it", () => {
    expect(weeksInARow([w(0, 0, false), w(5, 0, true)])).toBe(0);
  });
});

describe("programs (v0.611)", () => {
  const waves = programByKey("strength-waves")!;
  const tens = programByKey("sets-of-ten")!;
  const full = programByKey("full-body-3")!;
  it("every program's days and defaults line up", () => {
    for (const p of PROGRAMS) {
      expect(p.defaultDays.length).toBe(p.days.length);
      if (p.days.some((d) => d.roles.some((r) => r.scheme.kind === "WAVE"))) expect(p.wave?.length).toBe(p.weeks);
    }
  });
  it("schemes round-trip", () => {
    for (const k of ["wave", "range:3x8-12", "same:3x5"]) expect(schemeKey(parseScheme(k)!)).toBe(k);
    expect(parseScheme("nonsense")).toBeNull();
  });
  it("weeks cycle from the block start", () => {
    expect(programWeek(waves, "2026-10-25", "2026-10-30")).toBe(1);
    expect(programWeek(waves, "2026-10-25", "2026-11-15")).toBe(4);
    expect(programWeek(waves, "2026-10-25", "2026-11-22")).toBe(1);
    expect(blocksDone(waves, "2026-10-25", "2026-11-21")).toBe(0);
    expect(blocksDone(waves, "2026-10-25", "2026-11-22")).toBe(1);
    expect(weekLabel(waves, 4)).toBe("Week 4 of 4 · light");
  });
  it("waves: the week's sets from the training max, or last time without one", () => {
    expect(targetsFor({ program: waves, week: 3, scheme: { kind: "WAVE" }, unit: "lb", trainingMax: 170, last: [] })).toEqual([
      { weight: 130, reps: 5, top: undefined },
      { weight: 145, reps: 3, top: undefined },
      { weight: 160, reps: 1, top: true },
    ]);
    const t = targetsFor({ program: waves, week: 1, scheme: { kind: "WAVE" }, unit: "lb", trainingMax: null, last: [{ weight: 135, reps: 5 }] });
    expect(t.map((x) => x.weight)).toEqual([135, null, null]);
  });
  it("rep range: up a step once every set reached the top, else one more rep", () => {
    const scheme = parseScheme("range:3x8-12")!;
    const up = targetsFor({ program: tens, week: 1, scheme, unit: "lb", lower: true, last: [12, 12, 12].map((r) => ({ weight: 100, reps: r })) });
    expect(up).toEqual([1, 2, 3].map(() => ({ weight: 110, reps: 8 })));
    const more = targetsFor({ program: tens, week: 1, scheme, unit: "lb", last: [{ weight: 50, reps: 10 }, { weight: 50, reps: 9 }, { weight: 50, reps: 8 }] });
    expect(more[0]).toEqual({ weight: 50, reps: 9 });
  });
  it("same weight: up once every rep was done; light week drops a set at 80%", () => {
    const scheme = parseScheme("same:3x5")!;
    const done = [5, 5, 5].map((r) => ({ weight: 135, reps: r }));
    expect(targetsFor({ program: full, week: 1, scheme, unit: "lb", last: done })[0]).toEqual({ weight: 140, reps: 5 });
    const light = targetsFor({ program: full, week: 4, scheme, unit: "lb", last: done });
    expect(light).toEqual([{ weight: 110, reps: 5 }, { weight: 110, reps: 5 }]);
  });
  it("test week works up to a heavy 3 at the best for 3+", () => {
    const t = targetsFor({ program: tens, week: 6, scheme: parseScheme("range:3x8-12")!, unit: "lb", last: [], bestForThree: 150 });
    expect(t.at(-1)).toEqual({ weight: 150, reps: 3, top: true });
    expect(t[0].weight).toBe(75);
  });
  it("raising maxes steps lower lifts further", () => {
    expect(raisedMaxes({ a: 170, b: 120 }, new Set(["a"]), "lb")).toEqual({ a: 180, b: 125 });
  });
  it("finds a default movement by name, ignoring case and plurals", () => {
    const role = waves.days[0].roles[0];
    expect(defaultMovement(role, [{ id: "x", name: "Back Squats" }])?.id).toBe("x");
  });
});
