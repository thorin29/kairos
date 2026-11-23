import { describe, expect, it } from "vitest";
import { emptyPrefs, sanitizePrefs } from "@/lib/notify-prefs-shape";

describe("notification choices", () => {
  it("starts with everything off", () => {
    const p = emptyPrefs();
    expect(p.calendar).toEqual({ mine: false, family: false, others: false });
    expect(p.tasks).toBe(false);
    expect(p.assigned).toBe(false);
    expect(p.places).toEqual([]);
  });

  it("keeps good choices and drops bad ones", () => {
    const p = sanitizePrefs({
      calendar: { mine: true, others: "yes" },
      tasks: true,
      places: [
        { id: "a1", about: "kid1", place: "z:Home", arrive: true, leave: false },
        { id: "a2", about: null, place: "n:abc", arrive: false, leave: true },
        { id: "a3", about: "kid1", place: "bogus", arrive: true, leave: true },
        { id: "a4", about: "kid1", place: "s:xyz", arrive: false, leave: false },
      ],
      safety: { speed: { kid1: 70, kid2: 3, "bad id!": 60 }, noUpdateHours: 4, lowBattery: 99 },
      quiet: { from: "22:00", to: "07:00" },
      extra: true,
    });
    expect(p.calendar).toEqual({ mine: true, family: false, others: false });
    expect(p.places.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(p.safety.speed).toEqual({ kid1: 70 });
    expect(p.safety.noUpdateHours).toBe(4);
    expect(p.safety.lowBattery).toBeNull();
    expect(p.quiet).toEqual({ from: "22:00", to: "07:00" });
  });
});
