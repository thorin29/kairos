import { describe, expect, it } from "vitest";
import { parseSwaps, planWeekday, swapName, withSwap, withoutSwap } from "@/lib/workouts/day-swap";
import { daySuggestion } from "@/lib/workouts/suggest";

describe("swapped days (v0.677)", () => {
  // 2026-11-09 is a Monday; Wednesday is 3, Friday 5.
  const swaps = withSwap([], { week: "2026-11-09", a: 3, b: 5 });
  it("trades two weekdays' plans for that week only", () => {
    expect(planWeekday(swaps, "2026-11-11")).toBe(5);
    expect(planWeekday(swaps, "2026-11-13")).toBe(3);
    expect(planWeekday(swaps, "2026-11-12")).toBe(4);
    expect(planWeekday(swaps, "2026-11-18")).toBe(3); // next week, back to normal
    expect(swapName(swaps, "2026-11-11")).toBe("Friday");
    expect(swapName(swaps, "2026-11-12")).toBeNull();
  });
  it("a new swap replaces either day's old one; undo puts both back", () => {
    const again = withSwap(swaps, { week: "2026-11-09", a: 3, b: 6 });
    expect(again).toEqual([{ week: "2026-11-09", a: 3, b: 6 }]);
    expect(withoutSwap(swaps, "2026-11-13")).toEqual([]);
  });
  it("reads back only good rows and drops old weeks", () => {
    const raw = JSON.stringify([...swaps, { week: "2026-10-05", a: 1, b: 2 }, { week: "x", a: 1, b: 2 }, { week: "2026-11-09", a: 2, b: 2 }]);
    expect(parseSwaps(raw, "2026-10-12")).toEqual(swaps);
  });
  it("the game card offers a swap when there's a day to trade with", () => {
    const s = daySuggestion({
      today: "2026-11-11",
      lastTrained: "2026-11-10",
      feedback: [],
      light: false,
      programIntent: null,
      answered: new Set<string>(),
      sport: { today: null, tomorrow: { kind: "GAME", label: "Hockey" }, tournamentGames: 0, swapWith: { dow: 5, day: "Friday" } },
      legMoves: ["Back squat"],
      lifting: true,
    });
    expect(s?.actions.map((a) => a.label)).toEqual(["Lighter legs", "Swap legs", "Swap with Friday", "Not today"]);
    expect(s?.actions[2].answer).toBe("swap:5");
  });
});
