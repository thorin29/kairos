import { describe, expect, it } from "vitest";
import { sportKindOf, tournamentDays } from "@/lib/sport/label";
import { daySuggestion, planFit, pushPullBalance } from "@/lib/workouts/suggest";
import { adjustIsLight, adjustLabel, cleanAdjust, loadsArea } from "@/lib/workouts/adjust";

const base = { today: "2026-11-11", lastTrained: "2026-11-10", feedback: [], light: false, programIntent: null, answered: new Set<string>() };

describe("hockey-aware (v0.676)", () => {
  it("tells games from practices, the event type's setting first", () => {
    expect(sportKindOf("Team A @ Team B")).toBe("GAME");
    expect(sportKindOf("Team A vs Team B")).toBe("GAME");
    expect(sportKindOf("Stick & Puck")).toBe("PRACTICE");
    expect(sportKindOf("Tuesday practice")).toBe("PRACTICE");
    expect(sportKindOf("Hockey")).toBe("OTHER");
    expect(sportKindOf("Hockey", "GAME")).toBe("GAME");
  });
  it("calls 3 games in 4 days a tournament", () => {
    expect(tournamentDays(["2026-11-13", "2026-11-14", "2026-11-15"])).toEqual(["2026-11-13", "2026-11-14", "2026-11-15"]);
    expect(tournamentDays(["2026-11-13", "2026-11-20", "2026-11-27"])).toEqual([]);
  });
  it("a game today or tomorrow with leg work offers lighter or swapped legs", () => {
    const s = daySuggestion({ ...base, sport: { today: null, tomorrow: { kind: "GAME", label: "Hockey" }, tournamentGames: 0 }, legMoves: ["Back squat"], lifting: true });
    expect(s?.title).toBe("Game tomorrow");
    expect(s?.actions.map((a) => a.answer)).toEqual(["legs:light", "legs:swap", "dismiss"]);
    // A practice, or no leg work, says nothing.
    expect(daySuggestion({ ...base, sport: { today: { kind: "PRACTICE", label: "Hockey" }, tomorrow: null, tournamentGames: 0 }, legMoves: ["Back squat"], lifting: true })).toBeNull();
    expect(daySuggestion({ ...base, sport: { today: { kind: "GAME", label: "Hockey" }, tomorrow: null, tournamentGames: 0 }, legMoves: [], lifting: true })).toBeNull();
  });
  it("a tournament asks for a lighter week first", () => {
    const s = daySuggestion({ ...base, sport: { today: { kind: "GAME", label: "Hockey" }, tomorrow: null, tournamentGames: 4 }, legMoves: ["Back squat"], lifting: true });
    expect(s?.key).toBe("tournament");
    expect(s?.why).toBe("4 games in 4 days. Lighter lifting until it's over?");
  });
  it("lighter legs keeps everything, isn't a light day, and swap legs loads by leg work", () => {
    const legs = cleanAdjust({ mode: "legs" })!;
    expect(adjustLabel(legs)).toBe("Lighter legs for the game");
    expect(adjustIsLight(legs)).toBe(false);
    const swap = cleanAdjust({ mode: "hurt", area: "LEGS", why: "game" })!;
    expect(adjustLabel(swap)).toBe("Legs kept fresh for the game");
    expect(loadsArea("LEGS", "Romanian deadlift")).toBe(true);
    expect(loadsArea("LEGS", "Bench press", "CHEST")).toBe(false);
  });
});

describe("plan too big (v0.676)", () => {
  it("counts planned against done and names the weekdays missed most", () => {
    const days = [];
    for (let i = 0; i < 21; i++) {
      const date = new Date(Date.parse("2026-10-21T12:00:00Z") + i * 86400000).toISOString().slice(0, 10);
      const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
      const planned = dow >= 1 && dow <= 5;
      days.push({ date, planned, done: planned && dow !== 4 && dow !== 5 });
    }
    const fit = planFit(days);
    expect(fit).toEqual({ planned: 15, done: 9, worst: ["Thursday", "Friday"] });
    const s = daySuggestion({ ...base, tooBig: fit });
    expect(s?.key).toBe("toobig");
    expect(s?.why).toBe("9 of 15 planned workouts done in 3 weeks. Missed most: Thursday and Friday.");
    expect(s?.actions.map((a) => a.answer)).toEqual(["editplan", "programs", "later"]);
    expect(daySuggestion({ ...base, tooBig: { planned: 15, done: 11, worst: [] } })).toBeNull();
  });
});

describe("push/pull balance (v0.676)", () => {
  const set = (date: string, pattern: string) => ({ date, pattern });
  it("no pulling in 2 weeks, or twice the pressing over 3", () => {
    const push = Array.from({ length: 6 }, () => set("2026-11-05", "PUSH"));
    expect(pushPullBalance(push, "2026-11-11")).toEqual({ push: 6, pull: 0, window: 14 });
    const heavy = [...Array.from({ length: 12 }, () => set("2026-11-01", "PUSH")), ...Array.from({ length: 5 }, () => set("2026-11-03", "PULL"))];
    expect(pushPullBalance(heavy, "2026-11-11")).toEqual({ push: 12, pull: 5, window: 21 });
    const even = [...Array.from({ length: 12 }, () => set("2026-11-01", "PUSH")), ...Array.from({ length: 8 }, () => set("2026-11-02", "PULL"))];
    expect(pushPullBalance(even, "2026-11-11")).toBeNull();
    const s = daySuggestion({ ...base, balance: { push: 6, pull: 0, window: 14, pick: { id: "row", name: "Barbell row" } } });
    expect(s?.title).toBe("Add barbell row today?");
    expect(s?.actions[0].answer).toBe("add:row");
  });
});

describe("ball moves take weight (v0.676.1)", () => {
  it("every medicine ball and slam ball move logs weight and reps", async () => {
    const { LIBRARY } = await import("@/lib/workouts/library");
    const { coreMetric } = await import("@/lib/workouts/core-library");
    const balls = LIBRARY.filter((e) => /med_balls|slam_ball/.test(e.equipment.join(",")));
    expect(balls.length).toBeGreaterThan(0);
    for (const e of balls) expect([e.name, e.metric]).toEqual([e.name, "WEIGHT"]);
    // An own workout saved as reps only still asks for the ball's weight.
    expect(coreMetric({ name: "Rotational throw", kind: "REPS", sets: 4, min: 6, max: 8 })).toBe("WEIGHT");
    expect(coreMetric({ name: "Sit-up", kind: "REPS", sets: 3, min: 20, max: 25 })).toBe("REPS");
  });
});

describe("weighted holds (v0.677.1)", () => {
  it("farmer, overhead kettlebell and plate pinch holds take a weight beside the time", async () => {
    const { isWeightedHold } = await import("@/lib/workouts/library");
    expect(["Farmer hold", "Overhead kettlebell hold", "Plate pinch hold"].every((n) => isWeightedHold({ name: n }))).toBe(true);
    expect(isWeightedHold({ name: "Mid-thigh pull hold" })).toBe(false);
    expect(isWeightedHold({ name: "Farmer carry" })).toBe(false);
  });
});
