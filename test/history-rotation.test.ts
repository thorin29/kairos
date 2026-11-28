import { describe, expect, it } from "vitest";
import { groupHistory } from "@/lib/workouts/history";

describe("Recent: rotation days (v0.815.4)", () => {
  it("lists a rotation's session by the rotation, the workout under it", () => {
    const days = groupHistory(
      [
        { id: "a", date: "2026-11-25", label: "Core · Hanging core", result: "4 movements", isRest: false, category: "WEIGHTS" },
        { id: "b", date: "2026-11-25", label: "Isometric · Rack pulls and holds", result: "", isRest: false, category: "ISOMETRIC" },
        { id: "c", date: "2026-11-21", label: "Arms · Dumbbell pump", result: "", isRest: false, category: "WEIGHTS" },
        { id: "d", date: "2026-11-26", label: "Core", result: "Hanging leg raise", isRest: false, category: "WEIGHTS" },
      ],
      [],
    );
    const by = new Map(days.map((d) => [d.date, d]));
    expect(by.get("2026-11-25")?.label).toBe("Core rotation · Isometric rotation");
    expect(by.get("2026-11-25")?.result).toBe("Hanging core · Rack pulls and holds");
    expect(by.get("2026-11-21")?.label).toBe("Arms rotation");
    expect(by.get("2026-11-21")?.result).toBe("Dumbbell pump");
    // A plain Core entry isn't a rotation.
    expect(by.get("2026-11-26")?.label).toBe("Core");
  });
});
