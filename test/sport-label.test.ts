import { describe, expect, it } from "vitest";
import { sportDayLabel } from "@/lib/sport/label";

describe("sport day label (v0.671)", () => {
  it("is Hockey unless the title, type or calendar names another sport", () => {
    expect(sportDayLabel("Hockey game")).toBe("Hockey");
    expect(sportDayLabel("Stick and puck")).toBe("Hockey");
    expect(sportDayLabel("")).toBe("Hockey");
    // A league feed's event is a matchup, not a sport: still Hockey.
    expect(sportDayLabel("Team A @ Team B", null, "Team schedule")).toBe("Hockey");
    expect(sportDayLabel("Practice", "Soccer practice")).toBe("Soccer");
    expect(sportDayLabel("Game", null, "Spring basketball")).toBe("Basketball");
    expect(sportDayLabel("Ultimate frisbee league night")).toBe("Hockey");
  });
});
