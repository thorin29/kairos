import { describe, expect, it } from "vitest";
import { fenceStep } from "@/lib/places/fence";
import { motionOf, type TimedPt } from "@/lib/places/geo";

describe("fenceStep", () => {
  it("records the first fix silently", () => {
    expect(fenceStep(null, 20, 100, 10)).toEqual({ inside: true, changed: false });
    expect(fenceStep(null, 500, 100, 10)).toEqual({ inside: false, changed: false });
  });
  it("arrives inside the radius", () => {
    expect(fenceStep({ inside: false }, 90, 100, 10)).toEqual({ inside: true, changed: true });
  });
  it("needs the margin to leave, so edge wobble doesn't flip", () => {
    expect(fenceStep({ inside: true }, 130, 100, 10)).toEqual({ inside: true, changed: false });
    expect(fenceStep({ inside: true }, 151, 100, 10)).toEqual({ inside: false, changed: true });
  });
  it("ignores fuzzy fixes", () => {
    expect(fenceStep({ inside: false }, 10, 100, 400)).toBeNull();
  });
});

// Invented coordinates.
const at = (s: number) => new Date(Date.UTC(2026, 10, 23, 12, 0, s));
const pt = (lat: number, s: number, speed: number | null): TimedPt => ({ lat, lng: 20, at: at(s), accuracyM: 10, speed });

describe("motionOf", () => {
  it("reads the phone's speed (m/s)", () => {
    expect(motionOf([pt(10, 120, 30), pt(10, 90, 31), pt(10, 60, 29)])).toBe("drive");
    expect(motionOf([pt(10, 120, 1.3), pt(10, 90, 1.4)])).toBe("walk");
    expect(motionOf([pt(10, 120, 3.5), pt(10, 90, 3.2)])).toBe("move");
  });
  it("falls back to distance over time", () => {
    // ~1,000 m in 100 s ≈ 22 mph
    expect(motionOf([pt(10 + 1000 / 111_195, 100, null), pt(10, 0, null)])).toBe("drive");
  });
});

import { cleanZone } from "@/lib/places/ingest-parse";
import { planDay } from "@/lib/places/day";

describe("cleanZone", () => {
  it("turns HA person states into zone names", () => {
    expect(cleanZone("home")).toBe("Home");
    expect(cleanZone("Work")).toBe("Work");
    expect(cleanZone("not_home")).toBeNull();
    expect(cleanZone("unknown")).toBeNull();
    expect(cleanZone(undefined)).toBeNull();
  });
});

describe("stop zones", () => {
  it("names a stop with the zone most of its reports were in", () => {
    const base = Date.UTC(2026, 10, 23, 6, 0);
    const p = (min: number, zone: string | null) => ({
      at: new Date(base + min * 60_000),
      lat: 10,
      lng: 20,
      accuracyM: 10,
      speed: null,
      zone,
    });
    const plan = planDay([p(0, "Home"), p(20, "Home"), p(40, null)], new Date(base));
    expect(plan.items[0].kind).toBe("stop");
    expect((plan.items[0] as { zone: string | null }).zone).toBe("Home");
  });
});
