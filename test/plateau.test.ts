import { describe, expect, it } from "vitest";
import { plateauGroups, plateauText, type PlateauSet } from "@/lib/workouts/plateau";

const TODAY = "2026-11-22";
const set = (group: string, id: string, name: string, date: string, weight: number, reps: number): PlateauSet => ({
  group,
  poolExerciseId: id,
  name,
  date,
  weight,
  reps,
});
// Older history to beat, then three days in the last 4 weeks.
const flat = (group: string, id: string, name: string, w: number) => [
  set(group, id, name, "2026-09-20", w, 8),
  set(group, id, name, "2026-10-25", w, 8),
  set(group, id, name, "2026-11-01", w - 10, 8),
  set(group, id, name, "2026-11-08", w, 8),
  set(group, id, name, "2026-11-15", w, 7),
];

describe("plateauGroups", () => {
  it("two main groups with no new best", () => {
    const g = plateauGroups([...flat("CHEST", "b", "Bench press", 185), ...flat("LEGS", "s", "Squat", 225)], TODAY);
    expect(g.map((x) => x.group)).toEqual(["CHEST", "LEGS"]);
    expect(g[0].movement).toMatchObject({ name: "Bench press", weight: 185, reps: 8, since: "2026-09-20" });
    const t = plateauText(g);
    expect(t.title).toBe("Chest and legs haven't moved in 4 weeks");
    expect(t.why).toBe("Bench press 185 × 8 and squat 225 × 8 since Sep 20.");
  });

  it("one stalled group isn't a plateau", () => {
    const up = [...flat("LEGS", "s", "Squat", 225), set("LEGS", "s", "Squat", "2026-11-20", 235, 8)];
    expect(plateauGroups([...flat("CHEST", "b", "Bench press", 185), ...up], TODAY)).toEqual([]);
  });

  it("needs something to beat and enough days", () => {
    const fresh = flat("CHEST", "b", "Bench press", 185).filter((s) => s.date >= "2026-10-25");
    expect(plateauGroups([...fresh, ...flat("LEGS", "s", "Squat", 225)], TODAY)).toEqual([]);
    const few = flat("CHEST", "b", "Bench press", 185).slice(0, 3);
    expect(plateauGroups([...few, ...flat("LEGS", "s", "Squat", 225)], TODAY)).toEqual([]);
  });

  it("arms and core don't count", () => {
    expect(plateauGroups([...flat("ARMS", "c", "Curl", 40), ...flat("LEGS", "s", "Squat", 225)], TODAY)).toEqual([]);
  });
});
