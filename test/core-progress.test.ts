import { describe, expect, it } from "vitest";
import { buildCoreSummary, coreGroupOf, moveChange, tagOf } from "@/lib/workouts/core-progress";
import type { CoreMove } from "@/lib/workouts/core-moves";
import { enduranceWeek, muscleWeek, type TrainSet } from "@/lib/workouts/training-heat";

function move(movement: string, name: string, kind: CoreMove["kind"], pts: [string, number, number?][]): CoreMove {
  const points = pts.map(([date, value, weight]) => ({ date, value, weight: weight ?? null }));
  const best = points.reduce((a, b) => (b.value > a.value ? b : a));
  return { movement, name, kind, points, best };
}

describe("core progress (v0.673)", () => {
  it("groups moves by what they work", () => {
    expect(coreGroupOf("Planks")).toBe("FRONT");
    expect(coreGroupOf("TRX fallout")).toBe("FRONT");
    expect(coreGroupOf("Side plank")).toBe("SIDES");
    expect(coreGroupOf("Suitcase carry")).toBe("SIDES");
    expect(coreGroupOf("Hanging leg raise")).toBe("FLEXION");
    expect(coreGroupOf("Cable crunch")).toBe("FLEXION");
    expect(coreGroupOf("Something new")).toBe("OTHER");
  });

  it("compares a move's recent best with its first session", () => {
    const plank = move("p", "Planks", "time", [["2026-08-03", 105], ["2026-10-26", 120], ["2026-11-05", 126]]);
    expect(moveChange(plank)).toBe(20);
    expect(moveChange(move("x", "Planks", "time", [["2026-11-05", 90]]))).toBeNull();
    // Weighted reps go by the estimated max.
    const crunch = move("c", "Cable crunch", "reps", [["2026-09-01", 12, 50], ["2026-11-02", 12, 60]]);
    expect(moveChange(crunch)).toBe(20);
    expect(tagOf(2)).toBe("flat");
    expect(tagOf(3)).toBe("up");
    expect(tagOf(-5)).toBe("down");
    expect(tagOf(null)).toBe("new");
  });

  it("takes the middle of the moves, groups recent ones and sets old ones aside", () => {
    const moves = [
      move("p", "Planks", "time", [["2026-08-03", 100], ["2026-11-05", 120]]), // +20
      move("s", "Side plank", "time", [["2026-08-04", 30], ["2026-11-04", 33]]), // +10
      move("l", "Hanging leg raise", "reps", [["2026-08-05", 8], ["2026-11-04", 8]]), // 0
      move("o", "Ab wheel rollout", "reps", [["2026-08-06", 5], ["2026-08-20", 6]]), // old
    ];
    const s = buildCoreSummary(moves, [{ date: "2026-08-03", seconds: 100, pft: 70 }, { date: "2026-11-05", seconds: 120, pft: 75 }], "2026-11-11")!;
    expect(s.change).toBe(15); // middle of 20, 20, 10, 0
    expect(s.idle).toEqual(["o"]);
    expect(s.recent).toBe(3);
    expect(s.improving).toBe(2);
    expect(s.groups.map((g) => g.key)).toEqual(["FRONT", "SIDES", "FLEXION"]);
    expect(s.series[0]).toEqual({ date: "2026-08-03", value: 0 });
    expect(s.series.at(-1)?.value).toBe(15);
    expect(s.tests.at(-1)?.value).toBe(20);
    expect(s.plankBest).toEqual({ seconds: 120, pft: 75 });
    expect(s.daysThisWeek).toBe(0);
    expect(s.daysThisMonth).toBe(2); // Nov 4 and 5
    expect(s.newBests30).toBe(2);
  });

  it("is null with no core work", () => {
    expect(buildCoreSummary([], [], "2026-11-11")).toBeNull();
  });
});

describe("this week in the map pop-ups (v0.673)", () => {
  const set = (date: string, name: string, weight: number | null, reps: number | null, seconds: number | null = null): TrainSet => ({
    date,
    movement: name,
    name,
    primary: "ARMS",
    secondary: [],
    weight,
    reps,
    seconds,
    credit: 1,
  });

  it("counts a muscle's sets this week, a row per movement with its top set", () => {
    const sets = [
      set("2026-11-09", "Curl", 30, 12),
      set("2026-11-09", "Curl", 35, 10),
      set("2026-11-10", "Triceps pushdown", 50, 12),
      set("2026-11-02", "Curl", 40, 8), // last week
    ];
    const w = muscleWeek(sets, "2026-11-09", "2026-11-11");
    expect(w.headline).toBe("3 sets this week");
    expect(w.rows[0]).toEqual({ name: "Curl", detail: "Top set 35 × 10", amount: "2 sets" });
    expect(muscleWeek([], "2026-11-09", "2026-11-11").headline).toBe("No sets this week");
  });

  it("gives endurance's exact minutes, a row for sport, cardio and conditioning", () => {
    const w = enduranceWeek(
      [
        { date: "2026-11-09", minutes: 60, kind: "hockey", type: "sport", effort: "HARD" },
        { date: "2026-11-10", minutes: 60, kind: "hockey", type: "sport" },
        { date: "2026-11-10", minutes: 16, kind: "rowing", type: "cardio" },
        { date: "2026-11-11", minutes: 12, kind: "conditioning", type: "conditioning" },
        { date: "2026-11-05", minutes: 45, kind: "rowing", type: "cardio" },
      ],
      "2026-11-09",
      "2026-11-11",
    );
    expect(w.headline).toBe("148 min this week");
    expect(w.rows).toEqual([
      { name: "Sport", detail: "Hockey · 2 sessions", amount: "120 min" },
      { name: "Cardio", detail: "Rowing · 1 session", amount: "16 min" },
      { name: "Conditioning", detail: "1 workout", amount: "12 min" },
    ]);
  });
});
