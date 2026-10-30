import { describe, expect, it } from "vitest";
import { topSet, setsSummary, fmtSet } from "@/lib/workouts/sets";
import { platesFor, PLATE_BY_ID } from "@/lib/workouts/plates";
import { isHoldName, poolMetricFor } from "@/lib/workouts/catalog";
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
