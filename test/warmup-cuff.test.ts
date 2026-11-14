import { describe, expect, it } from "vitest";
import { cuffFirst, withShoulderPrep, type WarmupStep } from "@/lib/workouts/warmup-library";

const s = (name: string): WarmupStep => ({ name, kind: "REPS", amount: "10" });
const names = (steps: WarmupStep[] | readonly WarmupStep[] | undefined) => (steps ?? []).map((x) => x.name);

describe("rotator cuff first (v0.721)", () => {
  it("puts Shoulder prep ahead of the first arm or upper-body step", () => {
    const r = withShoulderPrep(
      { id: "x", name: "Arms day", mine: false, steps: [s("Leg swings"), s("Arm circles"), s("Push-ups")] },
      true,
      "2026-11-14",
    );
    const n = names(r?.steps);
    const cuff = n.findIndex((x) => /external rotation/i.test(x));
    expect(n[0]).toBe("Leg swings");
    expect(cuff).toBeGreaterThan(0);
    expect(cuff).toBeLessThan(n.indexOf("Arm circles"));
    expect(n.indexOf("Arm circles")).toBeLessThan(n.indexOf("Push-ups"));
  });
  it("moves a routine's own cuff steps up, on any day", () => {
    const steps = [s("Cat-cow"), s("Push-ups"), s("Chin-ups"), s("Band external rotation at 90°"), s("Glute bridges")];
    expect(names(cuffFirst(steps))).toEqual(["Cat-cow", "Band external rotation at 90°", "Push-ups", "Chin-ups", "Glute bridges"]);
    const r = withShoulderPrep({ id: "y", name: "Upper", mine: false, steps }, false);
    expect(names(r?.steps)[1]).toBe("Band external rotation at 90°");
  });
  it("adds the prep at the end when nothing works the arms", () => {
    const r = withShoulderPrep({ id: "z", name: "Legs", mine: false, steps: [s("Bodyweight squats"), s("Leg swings")] }, true);
    expect(names(r?.steps).slice(0, 2)).toEqual(["Bodyweight squats", "Leg swings"]);
  });
});
