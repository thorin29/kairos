import { describe, expect, it } from "vitest";
import { sportDayLabel } from "@/lib/sport/label";

describe("sport day label (v0.662)", () => {
  it("calls anything on the ice Hockey, else the event's title", () => {
    expect(sportDayLabel("Hockey game")).toBe("Hockey");
    expect(sportDayLabel("Stick and puck")).toBe("Hockey");
    expect(sportDayLabel("Adult drop-in")).toBe("Hockey");
    expect(sportDayLabel("")).toBe("Hockey");
    expect(sportDayLabel("Soccer")).toBe("Soccer");
    expect(sportDayLabel("Ultimate frisbee league night")).toBe("Ultimate frisbe…");
  });
});
