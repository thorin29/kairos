import { describe, expect, it } from "vitest";
import { goAnswer, goKeep, goLightOptions, parseGo } from "@/lib/workouts/go-light";

const entries = [
  { category: "WARMUP", exercises: [] },
  { category: "WEIGHTS", exercises: [{ poolExerciseId: "squat" }, { poolExerciseId: "lunge" }] },
  { category: "WEIGHTS", exercises: [{ poolExerciseId: "bench" }, { poolExerciseId: "fly" }] },
  { category: "WEIGHTS", core: true, exercises: [{ poolExerciseId: "plank" }] },
  { category: "ROWING", exercises: [{ poolExerciseId: "row" }] },
];

describe("go light (v0.654)", () => {
  it("suggests by the reason", () => {
    expect(goLightOptions({ why: "energy", minutes: 20, hurt: false }, 2).suggest.key).toBe("lighter");
    expect(goLightOptions({ why: "time", minutes: 10, hurt: false }, 2).suggest.key).toBe("short");
    expect(goLightOptions({ why: "energy", minutes: 30, hurt: true }, 2).suggest.key).toBe("recovery");
    const sick = goLightOptions({ why: "sick", minutes: 20, hurt: false, neck: "below" }, 2);
    expect(sick.rest).toBe(true);
    expect(sick.others).toHaveLength(2);
  });
  it("keeps main lifts only, as many as the time allows", () => {
    expect(goKeep("lighter", 30, entries)).toEqual([[], ["squat"], ["bench"], [], ["row"]]);
    expect(goKeep("short", 10, entries)).toEqual([[], ["squat"], [], [], ["row"]]);
    expect(goKeep("recovery", 20, entries)).toEqual([[], [], [], [], ["row"]]);
  });
  it("stores and reads the choice", () => {
    expect(parseGo(goAnswer("short", 20))).toEqual({ key: "short", minutes: 20 });
    expect(parseGo("light")).toBeNull();
    // Any amount of time (v0.656): every main lift stays.
    expect(parseGo(goAnswer("short", 0))).toEqual({ key: "short", minutes: 0 });
    expect(goKeep("short", 0, entries)).toEqual([[], ["squat"], ["bench"], [], ["row"]]);
  });
});
