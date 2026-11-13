import { describe, expect, it } from "vitest";
import { groupsFor, heartMinutes, involvementFor, navRegionFor } from "@/lib/workouts/involvement";

describe("full-body moves (v0.696)", () => {
  it("gives lifts the muscle that drives them, so they reach the body map", () => {
    expect(navRegionFor("Power clean", "FULL_BODY")).toBe("LEGS");
    expect(navRegionFor("Dumbbell thruster", "FULL_BODY")).toBe("LEGS");
    expect(navRegionFor("Kettlebell snatch", "FULL_BODY")).toBe("LEGS");
    expect(navRegionFor("Kettlebell clean and press", "FULL_BODY")).toBe("SHOULDERS");
    expect(navRegionFor("Turkish get-up", "FULL_BODY")).toBe("CORE");
    expect(navRegionFor("Sandbag over shoulder", "FULL_BODY")).toBe("LEGS");
    expect(navRegionFor("Mid-thigh pull hold", "FULL_BODY")).toBe("BACK");
    expect(groupsFor("Power clean", "FULL_BODY")).toMatchObject({ primary: "LEGS", secondary: ["BACK", "SHOULDERS", "CORE"] });
  });

  it("sends conditioning moves to the heart, with no muscle", () => {
    for (const n of ["Burpee", "Bear crawl", "Jump rope", "Ball slam", "Wall ball", "Over-shoulder toss", "Overhead throw"]) {
      expect(involvementFor(n)?.endurance).toBe(true);
      expect(navRegionFor(n, "FULL_BODY")).toBeNull();
    }
    // Filed under a muscle, the muscle still wins (no heart minutes then).
    expect(groupsFor("Rotational slam", "CORE").primary).toBe("CORE");
  });

  it("leaves mobility out", () => {
    expect(involvementFor("Inchworm")).toBeNull();
    expect(involvementFor("World's greatest stretch")).toBeNull();
  });

  it("counts a set's time, else a minute a set", () => {
    expect(heartMinutes(90)).toBe(1.5);
    expect(heartMinutes(null)).toBe(1);
    expect(heartMinutes(0)).toBe(1);
  });
});
