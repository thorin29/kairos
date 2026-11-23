import { describe, expect, it } from "vitest";
import { decodePolyline, distanceToPath, isSparse, routeLooksRight, waypointRuns } from "@/lib/places/route-check";

// A straight road heading north from an arbitrary origin; ~111 m per 0.001°.
const road = (n: number, step = 0.001) => Array.from({ length: n }, (_, i) => ({ lat: 40 + i * step, lng: -100 }));
const asPath = (pts: { lat: number; lng: number }[]) => pts.map((p) => [p.lat, p.lng] as [number, number]);

describe("route-check", () => {
  it("decodes Google's example polyline", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it("calls a drive sparse only when reports are far apart", () => {
    expect(isSparse(road(20))).toBe(false);
    expect(isSparse(road(5, 0.01))).toBe(true);
  });

  it("thins waypoints and keeps ≤10 intermediates per call", () => {
    const pts = road(400); // ~44 km
    const runs = waypointRuns(pts);
    expect(runs.length).toBeLessThanOrEqual(4);
    for (const r of runs) expect(r.length).toBeLessThanOrEqual(12);
    expect(runs[0][0]).toBe(0);
    expect(runs[runs.length - 1].at(-1)).toBe(399);
    for (let i = 1; i < runs.length; i++) expect(runs[i][0]).toBe(runs[i - 1].at(-1));
  });

  it("measures distance to a path segment", () => {
    const path = asPath(road(2, 0.01));
    expect(distanceToPath({ lat: 40.005, lng: -100 }, path)).toBeLessThan(1);
    expect(distanceToPath({ lat: 40.005, lng: -99.998 }, path)).toBeGreaterThan(150);
  });

  it("accepts a route through the reports", () => {
    const pts = road(6, 0.01); // ~5.5 km
    expect(routeLooksRight(pts, asPath(road(60, 0.001)), 300)).toBe(true);
  });

  it("rejects a route that misses a report (off-road)", () => {
    const pts = road(6, 0.01);
    pts[3] = { lat: pts[3].lat, lng: -99.995 }; // ~430 m off the road
    expect(routeLooksRight(pts, asPath(road(60, 0.001)), 300)).toBe(false);
  });

  it("rejects a route too long for the time taken", () => {
    const pts = road(6, 0.01);
    expect(routeLooksRight(pts, asPath(road(60, 0.001)), 60)).toBe(false);
  });
});
