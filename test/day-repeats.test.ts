import { describe, expect, it } from "vitest";
import { repeatsByPlan } from "@/lib/workouts/day-repeats";

const plan = (id: string, name: string, ids: string[]) => ({ id, name, exercises: ids.map((poolExerciseId) => ({ poolExerciseId })) });

describe("repeatsByPlan", () => {
  it("keeps a movement on the first card and drops it from later ones", () => {
    const r = repeatsByPlan([plan("core", "Core", ["plank", "hollow"]), plan("iso", "Isometric", ["hang", "hollow"])]);
    expect(r.has("core")).toBe(false);
    expect([...r.get("iso")!.entries()]).toEqual([["hollow", "Core"]]);
  });
  it("leaves a card's own double alone and ignores blank ids", () => {
    const r = repeatsByPlan([plan("a", "A", ["x", "x", ""]), plan("b", "B", ["", "y"])]);
    expect(r.size).toBe(0);
  });
  it("names the first card for every later repeat", () => {
    const r = repeatsByPlan([plan("a", "A", ["x"]), plan("b", "B", ["x"]), plan("c", "C", ["x"])]);
    expect(r.get("b")!.get("x")).toBe("A");
    expect(r.get("c")!.get("x")).toBe("A");
  });
});
