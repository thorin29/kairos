/**
 * What the phone sends for a walk, run, ruck or hike it tracked (v0.777),
 * checked and tidied. Pure, for the tests; the write is in tracked.ts.
 */

export const TRACK_ACTIVITIES = ["walk", "run", "ruck", "hike"] as const;
export type TrackActivity = (typeof TRACK_ACTIVITIES)[number];

export type TrackIn = {
  clientId: string;
  activity: TrackActivity;
  startAt: Date;
  endAt: Date;
  movingSec: number;
  distanceM: number;
  /** Pack weight, in the household's weight unit (ruck only). */
  load: number | null;
  /** [lat, lng, ms], oldest first. */
  path: [number, number, number][];
};

/** A long hike at one fix a few seconds apart stays drawable. */
export const MAX_PATH_POINTS = 4_000;
const MAX_SPAN_MS = 24 * 3_600_000;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function cleanPath(raw: unknown, startMs: number, endMs: number): [number, number, number][] {
  if (!Array.isArray(raw)) return [];
  const pts: [number, number, number][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 3) continue;
    const [lat, lng, t] = [num(p[0]), num(p[1]), num(p[2])];
    if (lat == null || lng == null || t == null) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) continue;
    if (t < startMs - 60_000 || t > endMs + 60_000) continue;
    if (pts.length > 0 && t < pts[pts.length - 1][2]) continue;
    pts.push([Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6, Math.round(t)]);
  }
  if (pts.length <= MAX_PATH_POINTS) return pts;
  // Evenly thinned, keeping the last point.
  const step = pts.length / (MAX_PATH_POINTS - 1);
  const out: [number, number, number][] = [];
  for (let i = 0; i < MAX_PATH_POINTS - 1; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts[pts.length - 1]);
  return out;
}

export function parseTrack(b: Record<string, unknown> | null): TrackIn | null {
  if (!b) return null;
  const clientId = typeof b.clientId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(b.clientId) ? b.clientId : null;
  const activity = TRACK_ACTIVITIES.find((a) => a === b.activity) ?? null;
  const startAt = typeof b.startAt === "string" ? new Date(b.startAt) : null;
  const endAt = typeof b.endAt === "string" ? new Date(b.endAt) : null;
  if (!clientId || !activity || !startAt || !endAt) return null;
  const s = startAt.getTime();
  const e = endAt.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || e - s > MAX_SPAN_MS || e > Date.now() + 5 * 60_000) return null;
  const movingSec = num(b.movingSec);
  const distanceM = num(b.distanceM);
  if (movingSec == null || movingSec <= 0 || movingSec > (e - s) / 1000 + 60) return null;
  if (distanceM == null || distanceM < 0 || distanceM > 200_000) return null;
  const load = activity === "ruck" ? num(b.load) : null;
  return {
    clientId,
    activity,
    startAt,
    endAt,
    movingSec: Math.round(movingSec),
    distanceM,
    load: load != null && load > 0 && load <= 500 ? load : null,
    path: cleanPath(b.path, s, e),
  };
}
