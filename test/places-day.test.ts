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
  // A slow dog walk (v0.815.1): 8 minutes inside 120 m, the phone reading
  // 1 m/s on about half its reports, as Home Assistant sent it.
  const dogWalk = (from: number, startMin: number): DayPoint[] =>
    Array.from({ length: 20 }, (_, k) => p(from + k * 5, startMin + k * 0.4, k % 2 === 0 ? 1 : 0, 9));

  it("doesn't make a stop of a slow walk the phone says was moving", () => {
    const home = (m: number, min: number): DayPoint => ({ ...p(m, min, 0), zone: "Home" });
    const pts = [home(0, 0), home(5, 60), home(0, 120), ...dogWalk(300, 121), home(0, 135), home(5, 200)];
    const stops = planDay(pts, at(0)).items.filter((i) => i.kind === "stop");
    expect(stops.every((st) => st.kind === "stop" && st.zone === "Home")).toBe(true);
  });

  it("still makes a stop where the phone reads 0", () => {
    const still = Array.from({ length: 20 }, (_, k) => p(3000 + (k % 3) * 5, 60 + k * 0.5, k === 7 ? 1 : 0, 9));
    const pts = [p(0, 0), p(0, 30), p(1500, 45, 12), ...still, p(1500, 80, 12), p(0, 95), p(0, 120)];
    const kinds = planDay(pts, at(0)).items.map((i) => i.kind);
    expect(kinds.filter((k) => k === "stop")).toHaveLength(3);
  });

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

describe("a drive the phone was quiet for (v0.790)", () => {
  it("calls a quiet trip with one report on the way out a drive", () => {
    const pts: DayPoint[] = [
      p(0, 470, 0), p(10, 480, 0), p(5, 490, 0), // home
      p(250, 509, 0), // just outside, 8:29
      p(6276, 541, 0), p(6280, 560, 0), p(6270, 600, 0), // work from 9:01
    ];
    expect(planDay(pts, at(0)).items.map((i) => i.kind)).toEqual(["stop", "drive", "stop"]);
  });

  it("calls 4 miles in 32 minutes with no reports between a drive, not a walk", () => {
    const pts: DayPoint[] = [
      p(0, 480, 0), p(10, 495, 0), p(5, 509, 0), // home until 8:29, speed 0
      p(6276, 541, 0), p(6280, 560, 0), p(6270, 600, 0), // work from 9:01
    ];
    const plan = planDay(pts, at(0));
    const kinds = plan.items.map((i) => i.kind);
    expect(kinds).toEqual(["stop", "drive", "stop"]);
    const leg = plan.items[1];
    expect(leg.kind === "drive" && leg.topMps).toBeNull();
  });

  it("keeps a slow walk with steady reports a walk", () => {
    const pts: DayPoint[] = [
      p(0, 60), p(10, 75), p(5, 90),
      ...Array.from({ length: 15 }, (_, k) => p(100 + k * 90, 92 + k * 2, 1.3)),
      p(1500, 125), p(1510, 140),
    ];
    expect(planDay(pts, at(0)).items.map((i) => i.kind)).toEqual(["stop", "move", "stop"]);
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

describe("stops in one place", () => {
  it("joins two stops split by GPS drift inside one building", () => {
    const at = (min: number, lat: number): DayPoint => ({
      at: new Date(BASE + min * 60_000),
      lat,
      lng: -90,
      accuracyM: 15,
      speed: 0.5,
    });
    const pts: DayPoint[] = [];
    for (let m = 0; m <= 10; m += 1) pts.push(at(m, 20)); // one end of the store
    pts.push(at(11, 20.0007), at(12, 20.0011)); // drifting across
    for (let m = 13; m <= 25; m += 1) pts.push(at(m, 20.0012)); // the other end, ~130 m away
    const plan = planDay(pts, new Date(BASE));
    expect(plan.items.filter((i) => i.kind === "stop")).toHaveLength(1);
  });
});

describe("quick stops at known places", () => {
  const at = (sec: number, lat: number, zone: string | null = null, speed = 0.3): DayPoint => ({
    at: new Date(BASE + sec * 1000),
    lat,
    lng: -91,
    accuracyM: 10,
    speed,
    zone,
  });
  const drive = (fromSec: number, fromLat: number, n: number) =>
    Array.from({ length: n }, (_, i) => at(fromSec + i * 60, fromLat + (i + 1) * 0.01, null, 20));

  it("counts a two-minute drop-off inside a zone", () => {
    const pts = [...drive(0, 30, 5), at(330, 30.06, "Rink"), at(400, 30.0601, "Rink"), at(450, 30.0602, "Rink"), ...drive(480, 30.0602, 5)];
    expect(planDay(pts, new Date(BASE)).items.filter((i) => i.kind === "stop")).toHaveLength(1);
  });

  it("doesn't count a short pause somewhere unknown", () => {
    const pts = [...drive(0, 30, 5), at(330, 30.06), at(400, 30.0601), at(450, 30.0602), ...drive(480, 30.0602, 5)];
    expect(planDay(pts, new Date(BASE)).items.filter((i) => i.kind === "stop")).toHaveLength(0);
  });

  it("counts a short stop at a saved place", () => {
    const pts = [...drive(0, 30, 5), at(330, 30.06), at(400, 30.0601), at(450, 30.0602), ...drive(480, 30.0602, 5)];
    const known = [{ lat: 30.0601, lng: -91, radiusM: 150 }];
    expect(planDay(pts, new Date(BASE), null, known).items.filter((i) => i.kind === "stop")).toHaveLength(1);
  });
});

describe("a phone that went quiet mid-trip", () => {
  const pts = [p(0, 60), p(10, 90), p(5, 120), p(2000, 123, 15), p(6000, 127, 18), p(9000, 130, 17)];

  it("ends the trip where it was last heard from after 10 minutes", () => {
    const items = planDay(pts, at(0), null, [], at(141).getTime()).items;
    expect(items.map((i) => i.kind)).toEqual(["stop", "drive", "stop"]);
    const last = items[2];
    expect(last.kind === "stop" && last.lastSeen).toBe(true);
    expect(last.start.toISOString()).toBe(at(130).toISOString());
  });

  it("keeps it a trip under way before then", () => {
    const items = planDay(pts, at(0), null, [], at(135).getTime()).items;
    expect(items.map((i) => i.kind)).toEqual(["stop", "drive"]);
  });
});
