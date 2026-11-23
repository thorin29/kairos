import { describe, expect, it } from "vitest";
import { planDay, type DayPoint } from "@/lib/places/day";
import { applyEdits, nearestTime } from "@/lib/places/day-edits";

// Invented coordinates. ~0.0009° latitude ≈ 100 m.
const BASE = Date.UTC(2026, 10, 23, 6, 0);
const pt = (min: number, lat: number, speed: number | null = null): DayPoint => ({
  at: new Date(BASE + min * 60_000),
  lat,
  lng: -90,
  accuracyM: 10,
  speed,
});

// Home (20 min) → drive → shop (20 min) → drive → park (20 min).
const points: DayPoint[] = [];
for (let m = 0; m <= 20; m += 2) points.push(pt(m, 10));
for (let m = 22; m <= 30; m += 2) points.push(pt(m, 10 + (m - 20) * 0.004, 15));
for (let m = 32; m <= 52; m += 2) points.push(pt(m, 10.044));
for (let m = 54; m <= 62; m += 2) points.push(pt(m, 10.044 + (m - 52) * 0.004, 15));
for (let m = 64; m <= 84; m += 2) points.push(pt(m, 10.088));

const plan = planDay(points, new Date(BASE));
const stops = () => plan.items.filter((i) => i.kind === "stop");

describe("day edits", () => {
  it("has three stops to start with", () => {
    expect(stops().length).toBe(3);
  });

  it("removing a stop joins the trips either side", () => {
    const shop = stops()[1];
    const { plan: p, removed } = applyEdits(plan, [{ id: "e1", kind: "remove", at: shop.start }]);
    expect(p.items.filter((i) => i.kind === "stop").length).toBe(2);
    expect(p.items.map((i) => i.kind)).toEqual(["stop", "drive", "stop"]);
    expect(removed).toHaveLength(1);
  });

  it("adding a stop on a trip splits it", () => {
    const leg = plan.items.find((i) => i.kind !== "stop")!;
    if (leg.kind === "stop") throw new Error("expected a trip");
    const at = nearestTime(leg.points, { lat: 10.016, lng: -90 })!;
    const { plan: p } = applyEdits(plan, [
      { id: "e2", kind: "add", at, lat: 10.016, lng: -90, name: "Gas station", address: null },
    ]);
    expect(p.items.filter((i) => i.kind === "stop").length).toBe(4);
    const added = p.items.find((i) => "editId" in i);
    expect(added && "name" in added ? added.name : null).toBe("Gas station");
  });
});
