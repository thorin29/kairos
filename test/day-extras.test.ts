import { describe, expect, it } from "vitest";
import { dayExtraKindOf, extraCategory, extraId, extraRowId, isExtraId } from "@/lib/workouts/day-extras";

describe("day extras", () => {
  it("an extra's id stands apart from plan entry ids and round-trips", () => {
    const id = extraId("abc123");
    expect(id).toBe("extra_abc123");
    expect(isExtraId(id)).toBe(true);
    expect(extraRowId(id)).toBe("abc123");
    expect(isExtraId("clx0plan")).toBe(false);
    expect(isExtraId("")).toBe(false);
    expect(isExtraId(null)).toBe(false);
  });
  it("only the three kinds, each under its section's category", () => {
    expect(dayExtraKindOf("mobility")).toBe("mobility");
    expect(dayExtraKindOf("iso")).toBe("iso");
    expect(dayExtraKindOf("conditioning")).toBeNull();
    expect(dayExtraKindOf(3)).toBeNull();
    expect(extraCategory("mobility")).toBe("MOBILITY");
    expect(extraCategory("stretching")).toBe("STRETCHING");
    expect(extraCategory("iso")).toBe("ISOMETRIC");
  });
});
