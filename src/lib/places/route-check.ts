/**
 * Pure helpers for road tracks from the Routes API: which drives are too
 * sparse for Roads snapping, which points become waypoints, and whether the
 * route Google returns is believable for what was recorded. A route that
 * strays from the points (a trail, a wrong turn guess) or is too long for the
 * time taken is rejected, and the raw points are drawn instead.
 */

import { metres } from "@/lib/places/geo";

type Pt = { lat: number; lng: number; accuracyM?: number | null };

/** Roads snapping interpolates well only between nearby reports. */
export const SPARSE_GAP_M = 400;
/** Waypoints are at least this far apart along the drive... */
const WAYPOINT_SPACING_M = 1_000;
/** ...and each call carries at most 10 intermediates (Google's Essentials tier). */
export const MAX_INTERMEDIATES = 10;
/** At most this many calls per drive; spacing widens to fit. */
const MAX_CALLS = 4;
/** Every recorded point must sit this close to the route (or within its own accuracy, up to 250 m). */
export const ON_ROUTE_M = 150;
/** Faster than this on average over the route means it's not the road they took. */
const MAX_AVG_MPS = 40;

export function isSparse(pts: Pt[]): boolean {
  for (let i = 1; i < pts.length; i++) if (metres(pts[i - 1], pts[i]) > SPARSE_GAP_M) return true;
  return false;
}

export function pathLength(path: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) {
    d += metres({ lat: path[i - 1][0], lng: path[i - 1][1] }, { lat: path[i][0], lng: path[i][1] });
  }
  return d;
}

/**
 * Waypoint calls for a drive: points thinned so neighbours are ≥1 km apart
 * (wider for long drives), split into runs of origin + ≤10 intermediates +
 * destination that share their ends. Returns indexes into pts.
 */
export function waypointRuns(pts: Pt[]): number[][] {
  if (pts.length < 2) return [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += metres(pts[i - 1], pts[i]);
  const perCall = MAX_INTERMEDIATES + 1;
  const spacing = Math.max(WAYPOINT_SPACING_M, total / (perCall * MAX_CALLS));

  const kept = [0];
  for (let i = 1; i < pts.length - 1; i++) {
    if (metres(pts[kept[kept.length - 1]], pts[i]) >= spacing) kept.push(i);
  }
  kept.push(pts.length - 1);

  const runs: number[][] = [];
  for (let s = 0; s < kept.length - 1; s += perCall) runs.push(kept.slice(s, s + perCall + 1));
  return runs;
}

/** Google's encoded polyline format. */
export function decodePolyline(enc: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < enc.length) {
    for (const which of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = enc.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d;
      else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

/** Metres from p to the nearest point of the path (flat-earth per segment). */
export function distanceToPath(p: Pt, path: [number, number][]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return metres(p, { lat: path[0][0], lng: path[0][1] });
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110_540;
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const ax = (path[i - 1][1] - p.lng) * kx;
    const ay = (path[i - 1][0] - p.lat) * ky;
    const bx = (path[i][1] - p.lng) * kx;
    const by = (path[i][0] - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    best = Math.min(best, Math.hypot(cx, cy));
  }
  return best;
}

/** True when the route fits every recorded point and the time it took. */
export function routeLooksRight(pts: Pt[], path: [number, number][], seconds: number): boolean {
  if (path.length < 2) return false;
  for (const p of pts) {
    const allow = Math.min(250, Math.max(ON_ROUTE_M, p.accuracyM ?? 0));
    if (distanceToPath(p, path) > allow) return false;
  }
  const routeM = pathLength(path);
  const pointsM = pathLength(pts.map((p) => [p.lat, p.lng]));
  // Too fast for the time taken, or a big detour the points never made.
  return routeM / Math.max(1, seconds) <= MAX_AVG_MPS && routeM <= pointsM * 2.5 + 2_000;
}
