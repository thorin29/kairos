/**
 * A person's day from their location points: stops and the trips between
 * them. Pure — the History page, today's tracks on the map and the tests all
 * use this one implementation.
 *
 *   stop  = stayed within STAY_RADIUS_M for at least STOP_MIN_MS
 *   drive = a trip averaging DRIVE_AVG_MPS or with a reported speed of
 *           DRIVE_TOP_MPS or more
 *   move  = any other trip (walking, a run, a trail) — drawn as recorded
 */
import { metres, STAY_RADIUS_M } from "@/lib/places/geo";

export type DayPoint = {
  at: Date;
  lat: number;
  lng: number;
  accuracyM: number | null;
  /** Metres per second, as Home Assistant sends it. */
  speed: number | null;
  /** Home Assistant zone, when known. */
  zone?: string | null;
  /** Direction of travel in degrees, when the phone reports it. */
  courseDeg?: number | null;
};

export type Stop = {
  kind: "stop";
  start: Date;
  end: Date;
  lat: number;
  lng: number;
  /** The Home Assistant zone most of the stop's reports were in, if any. */
  zone: string | null;
};

function mainZone(points: DayPoint[]): string | null {
  const count = new Map<string, number>();
  for (const p of points) if (p.zone) count.set(p.zone, (count.get(p.zone) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [z, c] of count) if (c > n) [best, n] = [z, c];
  return best && n * 2 >= points.length ? best : null;
}

export type Leg = {
  kind: "drive" | "move";
  start: Date;
  end: Date;
  points: DayPoint[];
  distanceM: number;
  /** Fastest moment in m/s (reported speed, else a careful estimate). */
  topMps: number | null;
};

export type DayPlan = { items: (Stop | Leg)[] };

export const STOP_MIN_MS = 5 * 60_000;
/** Points fuzzier than this are left out of paths and stops. */
export const MAX_ACCURACY_M = 250;
const DRIVE_AVG_MPS = 3.5; // ≈ 8 mph
const DRIVE_TOP_MPS = 6; // ≈ 13 mph
/** Only trust a speed worked out from two points when both are this sharp. */
const SHARP_M = 50;

export const MPS_TO_MPH = 2.23694;

function centroid(points: DayPoint[]): { lat: number; lng: number } {
  const n = points.length;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
    lng: points.reduce((s, p) => s + p.lng, 0) / n,
  };
}

function pathMetres(points: DayPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += metres(points[i - 1], points[i]);
  return d;
}

function topSpeed(points: DayPoint[]): number | null {
  let reported: number | null = null;
  for (const p of points) if (p.speed != null && (reported == null || p.speed > reported)) reported = p.speed;
  if (reported != null && reported > 0) return reported;
  // No speed from the phone: the median of point-to-point speeds between sharp
  // fixes (one GPS jump can't fake a top speed).
  const est: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const s = (b.at.getTime() - a.at.getTime()) / 1000;
    if (s <= 0 || (a.accuracyM ?? 0) > SHARP_M || (b.accuracyM ?? 0) > SHARP_M) continue;
    est.push(metres(a, b) / s);
  }
  if (est.length === 0) return reported;
  est.sort((x, y) => x - y);
  return est[Math.floor(est.length / 2)];
}

function legOf(points: DayPoint[]): Leg {
  const start = points[0].at;
  const end = points[points.length - 1].at;
  const distanceM = pathMetres(points);
  const secs = Math.max(1, (end.getTime() - start.getTime()) / 1000);
  const top = topSpeed(points);
  const drive = distanceM / secs >= DRIVE_AVG_MPS || (top != null && top >= DRIVE_TOP_MPS);
  return { kind: drive ? "drive" : "move", start, end, points, distanceM, topMps: top };
}

/**
 * Stops and trips for one day. `points` must be oldest first. Pass the last
 * point from before the day as `before` (with its time) so a day that starts
 * at home begins with a stop from `dayStart`.
 */
export function planDay(points: DayPoint[], dayStart: Date, before: DayPoint | null = null): DayPlan {
  const pts = points.filter((p) => p.accuracyM == null || p.accuracyM <= MAX_ACCURACY_M);
  if (before && (before.accuracyM == null || before.accuracyM <= MAX_ACCURACY_M)) {
    pts.unshift({ ...before, at: dayStart });
  }
  const items: (Stop | Leg)[] = [];
  let trip: DayPoint[] = [];
  let i = 0;
  while (i < pts.length) {
    let j = i + 1;
    while (j < pts.length && metres(pts[j], pts[i]) <= STAY_RADIUS_M) j++;
    const cluster = pts.slice(i, j);
    const span = cluster[cluster.length - 1].at.getTime() - cluster[0].at.getTime();
    const lastOfDay = j >= pts.length;
    // The newest place someone is still at counts as a stop even if short.
    const isStop = span >= STOP_MIN_MS || (lastOfDay && cluster.length >= 2 && items.length > 0 && span > 0);
    if (isStop) {
      if (trip.length > 0) {
        // The trip runs from the last stop's final point to this stop's first.
        const prevStop = items[items.length - 1];
        const lead =
          prevStop && prevStop.kind === "stop" ? [{ ...trip[0], ...centroidPoint(prevStop) }] : [];
        const legPts = [...lead, ...trip, cluster[0]];
        if (legPts.length >= 2) items.push(legOf(legPts));
        trip = [];
      }
      const c = centroid(cluster);
      items.push({
        kind: "stop",
        start: cluster[0].at,
        end: cluster[cluster.length - 1].at,
        lat: c.lat,
        lng: c.lng,
        zone: mainZone(cluster),
      });
      i = j;
    } else {
      trip.push(pts[i]);
      i++;
    }
  }
  if (trip.length > 0) {
    const prevStop = items[items.length - 1];
    const lead = prevStop && prevStop.kind === "stop" ? [{ ...trip[0], ...centroidPoint(prevStop) }] : [];
    const legPts = [...lead, ...trip];
    if (legPts.length >= 2) items.push(legOf(legPts));
  }
  return { items };
}

function centroidPoint(s: Stop): { lat: number; lng: number; at: Date } {
  return { lat: s.lat, lng: s.lng, at: s.end };
}

export type DayTotals = { distanceM: number; driveMs: number; topMps: number | null; stops: number };

export function totalsOf(plan: DayPlan): DayTotals {
  let distanceM = 0;
  let driveMs = 0;
  let topMps: number | null = null;
  let stops = 0;
  for (const it of plan.items) {
    if (it.kind === "stop") {
      stops++;
      continue;
    }
    distanceM += it.distanceM;
    if (it.kind === "drive") {
      driveMs += it.end.getTime() - it.start.getTime();
      if (it.topMps != null && (topMps == null || it.topMps > topMps)) topMps = it.topMps;
    }
  }
  return { distanceM, driveMs, topMps, stops };
}

/**
 * Whether Google's road-snapped path is believable: each original point's
 * snapped spot should be close by. Off-road or in a car park, Google drags
 * points onto the nearest road — then the raw points are the truth.
 */
export function snapLooksRight(offsetsM: number[]): boolean {
  if (offsetsM.length === 0) return false;
  const s = [...offsetsM].sort((a, b) => a - b);
  const median = s[Math.floor(s.length / 2)];
  const far = s.filter((d) => d > 60).length / s.length;
  return median <= 35 && far <= 0.3;
}
