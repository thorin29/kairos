import { describe, expect, it } from "vitest";
import { buildCoreMoves, coreValueText } from "@/lib/workouts/core-moves";

const set = (date: string, movement: string, x: { reps?: number; seconds?: number; weight?: number; primary?: string }) => ({
  date,
  movement,
  name: movement,
  primary: x.primary ?? "CORE",
  weight: x.weight ?? null,
  reps: x.reps ?? null,
  seconds: x.seconds ?? null,
});

describe("core moves", () => {
  it("a hold by its longest time a day; reps by the most, weight as context", () => {
    const out = buildCoreMoves([
      set("2026-11-01", "Plank", { seconds: 60 }),
      set("2026-11-01", "Plank", { seconds: 75 }),
      set("2026-11-08", "Plank", { seconds: 90 }),
      set("2026-11-02", "Cable crunch", { reps: 12, weight: 40 }),
      set("2026-11-02", "Cable crunch", { reps: 15, weight: 30 }),
      set("2026-11-02", "Squat", { reps: 5, weight: 200, primary: "LEGS" }),
    ]);
    expect(out.map((m) => m.name)).toEqual(["Cable crunch", "Plank"]);
    const plank = out[1];
    expect(plank.kind).toBe("time");
    expect(plank.points).toEqual([
      { date: "2026-11-01", value: 75, weight: null },
      { date: "2026-11-08", value: 90, weight: null },
    ]);
    expect(out[0].kind).toBe("reps");
    expect(out[0].best).toEqual({ date: "2026-11-02", value: 15, weight: 30 });
  });
  it("text: m:ss for holds, reps with any weight", () => {
    expect(coreValueText("time", 90, null, "lb")).toBe("1:30");
    expect(coreValueText("time", 45, null, "lb")).toBe("45 s");
    expect(coreValueText("reps", 25, null, "lb")).toBe("25 reps");
    expect(coreValueText("reps", 12, 25, "lb")).toBe("12 × 25 lb");
  });
});
