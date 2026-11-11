import { describe, expect, it } from "vitest";
import { parseSore, SORE_AREAS, SORE_PATHS, withSore, withoutSore } from "@/lib/workouts/sore";

describe("sore spots (v0.675)", () => {
  it("keeps one per area, the first day, until better", () => {
    let list = withSore([], { area: "KNEE", since: "2026-11-09", from: "Back squat" });
    list = withSore(list, { area: "KNEE", since: "2026-11-11", from: null });
    list = withSore(list, { area: "NECK", since: "2026-11-10", from: null });
    expect(list).toEqual([
      { area: "KNEE", since: "2026-11-09", from: "Back squat" },
      { area: "NECK", since: "2026-11-10", from: null },
    ]);
    expect(parseSore(JSON.stringify(list))).toEqual(list);
    expect(withoutSore(list, "KNEE").map((s) => s.area)).toEqual(["NECK"]);
  });
  it("reads only real areas and days back", () => {
    expect(parseSore('[{"area":"OTHER","since":"2026-11-01"},{"area":"HIP","since":"soon"},{"area":"HIP","since":"2026-11-02"}]')).toEqual([
      { area: "HIP", since: "2026-11-02", from: null },
    ]);
    expect(parseSore("not json")).toEqual([]);
  });
  it("puts every area somewhere on the body map", () => {
    for (const a of SORE_AREAS) expect(SORE_PATHS[a].front.length + SORE_PATHS[a].back.length).toBeGreaterThan(0);
  });
});
