import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/settings", () => ({ getSetting: async () => null }));

describe("plan card strip (v0.747)", () => {
  it("names each weekday's main work, marks rest, and lists the other days", async () => {
    const { buildStrip, shortName } = await import("@/lib/workouts/plan-summary");
    const w = (dayOfWeek: number, name: string, category: string | null, extra: object = {}) => ({
      dayOfWeek,
      name,
      category,
      muscleGroup: null,
      isRest: false,
      sortOrder: 0,
      ...extra,
    });
    const rows = [
      w(1, "Warm-up", "WARMUP"),
      w(1, "Rowing · 5/3/1", "ROWING", { sortOrder: 1 }),
      w(1, "Press day", "WEIGHTS", { sortOrder: 2 }),
      w(3, "Arms", "WEIGHTS", { muscleGroup: "ARMS" }),
      w(6, "Core · Rotation and power", "WEIGHTS", { muscleGroup: "CORE" }),
      w(0, "Rest", null, { isRest: true }),
    ];
    const { strip, others } = buildStrip(rows, new Set([1, 2, 4, 5]));
    expect(strip.map((d) => d.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(strip[1]).toEqual({ day: 1, label: "Press", kind: "lift", program: true });
    expect(strip[2]).toEqual({ day: 2, label: "", kind: "none", program: true });
    expect(strip[6]).toEqual({ day: 6, label: "Core", kind: "core", program: false });
    expect(strip[0]).toEqual({ day: 0, label: "Rest", kind: "rest", program: false });
    expect(others).toEqual(["Arms", "Core"]);
    expect(shortName("Squat day")).toBe("Squat");
    // Your own plan: no program, no "others".
    expect(buildStrip(rows, new Set()).others).toEqual([]);
  });
});
