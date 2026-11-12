import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  familyPlanId,
  isFamilyPlanId,
  mergeMembers,
  okWodDate,
  rankBoard,
  waitingText,
  whoText,
  type BoardInput,
} from "@/lib/workouts/family-wod";

const row = (userId: string, value: number | null, version: string | null, earlier: number[] = []): BoardInput => ({
  userId,
  name: userId,
  value,
  version,
  result: String(value),
  earlier,
});

describe("family WOD board", () => {
  it("ranks Rx above Scaled, most rounds first", () => {
    const b = rankBoard([row("a", 12, "SCALED"), row("b", 14, "RX"), row("c", 16, "RX"), row("d", 15, "SCALED")], "REPS");
    expect(b.map((r) => r.userId)).toEqual(["c", "b", "d", "a"]);
    expect(b.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("ranks the fastest time first", () => {
    const b = rankBoard([row("a", 500, null), row("b", 402, null)], "DURATION");
    expect(b[0].userId).toBe("b");
    expect(b[0].version).toBeNull();
  });

  it("keeps one row a person and puts no result last", () => {
    const b = rankBoard([row("a", null, "RX"), row("b", 10, "RX"), row("b", 9, "RX")], "REPS");
    expect(b.map((r) => r.userId)).toEqual(["b", "a"]);
  });

  it("marks a best yet only when it beats every earlier result", () => {
    const b = rankBoard([row("a", 16, "RX", [14, 15]), row("b", 14, "RX", [15]), row("c", 10, "RX")], "REPS");
    expect(b.find((r) => r.userId === "a")?.bestYet).toBe(true);
    expect(b.find((r) => r.userId === "b")?.bestYet).toBe(false);
    // A first try isn't a best yet.
    expect(b.find((r) => r.userId === "c")?.bestYet).toBe(false);
    const t = rankBoard([row("a", 400, null, [420])], "DURATION");
    expect(t[0].bestYet).toBe(true);
  });
});

describe("family WOD people", () => {
  it("names who's in", () => {
    expect(whoText(["Alex"], 4)).toBe("Alex");
    expect(whoText(["Alex", "Sam", "Jordan"], 4)).toBe("Alex, Sam and Jordan");
    expect(whoText(["Alex", "Sam", "Jordan", "Riley"], 4)).toBe("Everyone");
    expect(waitingText([])).toBeNull();
    expect(waitingText(["Sam"])).toBe("Sam hasn't logged yet");
    expect(waitingText(["Sam", "Riley"])).toBe("Sam and Riley haven't logged yet");
  });

  it("keeps who joined when a parent changes the people", () => {
    const m = mergeMembers(
      [
        { userId: "a", how: "ASSIGNED" },
        { userId: "b", how: "ASSIGNED" },
        { userId: "c", how: "JOINED" },
      ],
      ["a", "d"],
    );
    expect(m).toEqual([
      { userId: "a", how: "ASSIGNED" },
      { userId: "d", how: "ASSIGNED" },
      { userId: "c", how: "JOINED" },
    ]);
    // Picking someone who joined makes them assigned.
    expect(mergeMembers([{ userId: "c", how: "JOINED" }], ["c"])).toEqual([{ userId: "c", how: "ASSIGNED" }]);
  });

  it("takes days from today to 60 days on", () => {
    expect(okWodDate("2026-11-11", "2026-11-11", addDays)).toBe(true);
    expect(okWodDate("2026-11-10", "2026-11-11", addDays)).toBe(false);
    expect(okWodDate("2027-01-10", "2026-11-11", addDays)).toBe(true);
    expect(okWodDate("2027-01-11", "2026-11-11", addDays)).toBe(false);
    expect(okWodDate("soon", "2026-11-11", addDays)).toBe(false);
  });

  it("gives the day card an id of its own", () => {
    expect(familyPlanId("x1")).toBe("fwod_x1");
    expect(isFamilyPlanId("fwod_x1")).toBe(true);
    expect(isFamilyPlanId("plan1")).toBe(false);
  });
});
