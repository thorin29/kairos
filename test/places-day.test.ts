import { describe, expect, it } from "vitest";
import { planDay, snapLooksRight, totalsOf, type DayPoint } from "@/lib/places/day";

// Invented coordinates. ~0.0009° latitude ≈ 100 m.
const BASE = Date.UTC(2026, 10, 23, 6, 0); // local midnight in a UTC-6 household
const at = (min: number) => new Date(BASE + min * 60_000);
const north = (m: number) => 10 + m / 111_195;
const p = (m: number, min: number, speed: number | null = null, acc = 10): DayPoint => ({
  at: at(min),
  lat: north(m),
  lng: 20,
  accuracyM: acc,
  speed,
});

describe("planDay", () => {
  it("is empty with no points", () => {
    expect(planDay([], at(0)).items).toEqual([]);
  });

  it("splits home → drive → shop → walk → shop", () => {
    const pts: DayPoint[] = [
      p(0, 60), p(10, 90), p(5, 120), // home 1:00–2:00
      p(1000, 122, 14), p(3000, 124, 20), p(5000, 126, 18), // drive ~5 km in 6 min
      p(5050, 128), p(5060, 140), p(5040, 150), // shop 2:08–2:30
      p(5300, 155, 1.3), p(5600, 160, 1.4), p(5900, 165, 1.2), // walk ~900 m in 15 min
      p(5950, 170), p(5960, 185), // next stop
    ];
    const kinds = planDay(pts, at(0)).items.map((i) => i.kind);
    expect(kinds).toEqual(["stop", "drive", "stop", "move", "stop"]);
  });

  it("starts the day at home from the last point before midnight", () => {
    const before = p(0, -300);
    const plan = planDay([p(5, 400), p(8, 420)], at(0), before);
    expect(plan.items[0].kind).toBe("stop");
    expect(plan.items[0].start.toISOString()).toBe(at(0).toISOString());
  });

  it("leaves out very fuzzy points", () => {
    const plan = planDay([p(0, 0), p(9000, 5, null, 900), p(10, 30)], at(0));
    expect(plan.items.map((i) => i.kind)).toEqual(["stop"]);
  });

  it("totals distance, driving time and top speed", () => {
    const pts = [p(0, 0), p(0, 30), p(2000, 33, 25), p(4000, 36, 31), p(4000, 50), p(4010, 60)];
    const t = totalsOf(planDay(pts, at(0)));
    expect(t.stops).toBe(2);
    expect(t.topMps).toBe(31);
    expect(t.driveMs).toBeGreaterThan(0);
    expect(Math.round(t.distanceM / 100)).toBe(40);
  });
});

describe("snapLooksRight", () => {
  it("accepts a path that hugs the points", () => {
    expect(snapLooksRight([3, 5, 8, 12, 4, 6])).toBe(true);
  });
  it("rejects a path dragged onto a far road", () => {
    expect(snapLooksRight([80, 95, 120, 70, 10])).toBe(false);
    expect(snapLooksRight([])).toBe(false);
  });
});
