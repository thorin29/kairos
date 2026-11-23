/**
 * Places geometry and "where is this person now" rules. Pure, so they're
 * tested on their own and shared by the web page and the phone's API.
 */

export type Pt = { lat: number; lng: number };
export type TimedPt = Pt & { at: Date; accuracyM: number | null; speed: number | null };

const R_EARTH = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function metres(a: Pt, b: Pt): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** A lat/lng box around `p` that contains everything within `m` metres —
 *  a cheap index-friendly prefilter before measuring exactly. */
export function boxAround(p: Pt, m: number): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const dLat = (m / R_EARTH) * (180 / Math.PI);
  const dLng = dLat / Math.max(0.01, Math.cos(rad(p.lat)));
  return { minLat: p.lat - dLat, maxLat: p.lat + dLat, minLng: p.lng - dLng, maxLng: p.lng + dLng };
}

/** How far a person can drift and still be "in the same place". */
export const STAY_RADIUS_M = 120;
/** Two reports this far apart within this long mean they're travelling. */
const MOVE_WINDOW_MS = 15 * 60_000;
/** Raw speed at or above this counts as moving (true in m/s, km/h or mph). */
const MOVING_SPEED = 3;
/** No report for this long draws the person faded. A phone sitting still
 *  reports rarely, so this is deliberately long. */
export const STALE_MS = 12 * 60 * 60_000;

export type Presence = {
  /** The newest point. */
  latest: TimedPt;
  /** Travelling now (no place lookup while moving). */
  moving: boolean;
  /** When they arrived where they are (the oldest report still within reach
   *  of the newest one). Null while moving. */
  since: Date | null;
};

/**
 * Where someone is from their recent points, newest first. Stationary unless
 * the last two reports are far apart and close in time, or the phone itself
 * says it's moving.
 */
export function presenceOf(newestFirst: TimedPt[]): Presence | null {
  const latest = newestFirst[0];
  if (!latest) return null;
  const prev = newestFirst[1];

  const hopped =
    prev != null &&
    metres(prev, latest) > STAY_RADIUS_M &&
    latest.at.getTime() - prev.at.getTime() < MOVE_WINDOW_MS;
  const fast = latest.speed != null && latest.speed >= MOVING_SPEED;
  if (hopped || fast) return { latest, moving: true, since: null };

  let since = latest.at;
  for (const p of newestFirst.slice(1)) {
    if (metres(p, latest) > STAY_RADIUS_M) break;
    since = p.at;
  }
  return { latest, moving: false, since };
}

/** "123 Main St, Springfield, TX 75000, USA" → "123 Main St, Springfield". */
export function shortAddress(formatted: string | null | undefined): string | null {
  if (!formatted) return null;
  const parts = formatted.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.slice(0, 2).join(", ");
}

export type Motion = "drive" | "walk" | "move";

/**
 * How someone is moving, from the last couple of minutes (newest first):
 * the median reported speed, else distance over time between the newest
 * report and one about two minutes older. drive ≥ 10 mph, walk < 5 mph.
 */
export function motionOf(newestFirst: TimedPt[]): Motion {
  const latest = newestFirst[0];
  const recent = newestFirst.filter((p) => latest.at.getTime() - p.at.getTime() <= 3 * 60_000);
  const speeds = recent.map((p) => p.speed).filter((s): s is number => s != null).sort((a, b) => a - b);
  let mps: number | null = speeds.length > 0 ? speeds[Math.floor(speeds.length / 2)] : null;
  if (mps == null) {
    const older = newestFirst.find((p) => latest.at.getTime() - p.at.getTime() >= 90_000);
    if (older) mps = metres(older, latest) / ((latest.at.getTime() - older.at.getTime()) / 1000);
  }
  const mph = (mps ?? 0) * 2.23694;
  if (mph >= 10) return "drive";
  if (mph < 5) return "walk";
  return "move";
}
