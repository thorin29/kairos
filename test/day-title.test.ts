import { describe, expect, it } from "vitest";
import { cardLines } from "@/lib/workouts/day-title";
import { focusGroups } from "@/lib/workouts/focus";

describe("home card lines", () => {
  it("makes a core day the title and puts the rest under it, once each, no warm-up", () => {
    const l = cardLines(
      [
        { name: "Warm-up", category: "WARMUP" },
        { name: "Rowing", category: "ROW" },
        { name: "Core · Hanging core", category: "WEIGHTS" },
        { name: "Conditioning", category: "HIIT", hiitName: "Kettlebell ladder" },
      ],
      "5/3/1",
    );
    expect(l).toEqual({ title: "Core · Hanging core", extras: ["Rowing", "Kettlebell ladder"] });
  });

  it("leads with the program's main lift", () => {
    const l = cardLines(
      [
        { name: "Chest · 5/3/1", category: "WEIGHTS", mains: ["Bench press"] },
        { name: "Core · McGill Big 3", category: "WEIGHTS" },
        { name: "Rowing · 5/3/1", category: "ROW" },
      ],
      "5/3/1",
    );
    expect(l).toEqual({ title: "5/3/1 · Bench press", extras: ["Core · McGill Big 3", "Rowing"] });
  });

  it("falls back to conditioning, then cardio", () => {
    expect(cardLines([{ name: "Rowing", category: "ROW" }, { name: "Conditioning", category: "HIIT" }], null)).toEqual({
      title: "Conditioning",
      extras: ["Rowing"],
    });
    expect(cardLines([{ name: "Rowing", category: "ROW" }], null)).toEqual({ title: "Rowing", extras: [] });
    expect(cardLines([{ name: "Warm-up", category: "WARMUP" }], null).title).toBeNull();
  });
});

describe("progress focus", () => {
  const plan = [
    { day: 1, groups: ["CHEST"] },
    { day: 3, groups: ["CORE", "SHOULDERS"] },
    { day: 4, groups: [] },
    { day: 5, groups: ["BACK"] },
  ];
  it("opens on today's groups", () => expect(focusGroups(plan, 3)).toEqual(["CORE", "SHOULDERS"]));
  it("else the next planned day's", () => {
    expect(focusGroups(plan, 4)).toEqual(["BACK"]);
    expect(focusGroups(plan, 6)).toEqual(["CHEST"]);
  });
  it("is empty without a plan", () => expect(focusGroups([], 2)).toEqual([]));
});
