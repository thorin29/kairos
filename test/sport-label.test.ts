import { describe, expect, it } from "vitest";
import { cleanSport, eventSport, sportDayLabel } from "@/lib/sport/label";

describe("sport day label (v0.745)", () => {
  it("is the sport the names give, else just Sport", () => {
    expect(sportDayLabel("Hockey game")).toBe("Hockey");
    expect(sportDayLabel("Stick and puck")).toBe("Hockey");
    expect(sportDayLabel("")).toBe("Sport");
    // A league feed's event is a matchup, not a sport.
    expect(sportDayLabel("Team A @ Team B", null, "Team schedule")).toBe("Sport");
    expect(sportDayLabel("Practice", "Soccer practice")).toBe("Soccer");
    expect(sportDayLabel("Game", null, "Spring basketball")).toBe("Basketball");
    expect(sportDayLabel("Ultimate frisbee league night")).toBe("Sport");
  });

  it("goes by the type's or calendar's pick first", () => {
    expect(eventSport({ title: "Team A @ Team B", externalCalendar: { name: "Team schedule", sport: "Hockey" } })).toBe("Hockey");
    expect(eventSport({ title: "Hockey night", eventType: { name: "Game", sport: "Soccer" } })).toBe("Soccer");
    expect(eventSport({ title: "Team A @ Team B", eventType: { name: "Game", sport: null } })).toBe("Sport");
    expect(eventSport({ title: "Soccer practice", externalCalendar: { name: "x", sport: "Frisbee" } })).toBe("Soccer");
    expect(cleanSport("Hockey")).toBe("Hockey");
    expect(cleanSport("Frisbee")).toBeNull();
  });
});
