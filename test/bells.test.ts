import { describe, expect, it } from "vitest";
import { aboutWithBellNote, bellOf } from "@/lib/workouts/bells";

describe("bell weight note", () => {
  it("knows dumbbell and kettlebell movements by equipment or name", () => {
    expect(bellOf("Rear delt fly", "dumbbells")).toBe("dumbbell");
    expect(bellOf("reverse dumbbell flies", null)).toBe("dumbbell");
    expect(bellOf("Goblet squat", "kettlebells")).toBe("kettlebell");
    expect(bellOf("Back squat", "barbell")).toBeNull();
    expect(bellOf("Dead bug", "")).toBeNull();
  });
  it("adds the one-bell line to the how-to, or stands alone", () => {
    expect(aboutWithBellNote("Hinge forward.", "Rear delt fly", "dumbbells")).toBe(
      "Hinge forward. Weight: one dumbbell, the number on it, even with one in each hand.",
    );
    expect(aboutWithBellNote(null, "reverse dumbbell flies", null)).toMatch(/^Weight: one dumbbell/);
    expect(aboutWithBellNote("Bar on the back.", "Back squat", "barbell")).toBe("Bar on the back.");
  });
});
