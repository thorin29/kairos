import "server-only";
import { prisma } from "@/lib/prisma";
import { metres } from "@/lib/places/geo";
import { snapLooksRight, type DayPoint } from "@/lib/places/day";
import { bump, canCall } from "@/lib/places/usage";
import { decodePolyline, isSparse, routeLooksRight, waypointRuns } from "@/lib/places/route-check";

/**
 * Finished drives drawn along roads. Drives with frequent reports are snapped
 * with the Roads API (snapToRoads with interpolation, so curves between
 * reports follow the road). Drives with long gaps between reports, where
 * snapping would cut corners, are routed with the Routes API through the
 * reports as waypoints. Either answer must fit the recorded points or the raw
 * points are drawn (off-road, a bad guess). Asked once per drive and cached 30
 * days. A drive still under way is drawn from the raw points.
 */

const MAX_PER_CALL = 100;
const KEEP_MS = 30 * 24 * 60 * 60_000;
const TIMEOUT_MS = 8_000;

export type TrackPath = { path: [number, number][]; snapped: boolean };

const raw = (pts: DayPoint[]): TrackPath => ({ path: pts.map((p) => [p.lat, p.lng]), snapped: false });

type SnapResponse = {
  snappedPoints?: { location?: { latitude?: number; longitude?: number }; originalIndex?: number }[];
};

async function snapChunk(
  key: string,
  pts: DayPoint[],
): Promise<{ path: [number, number][]; offsets: number[] } | null> {
  const path = pts.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("|");
  try {
    const res = await fetch(
      `https://roads.googleapis.com/v1/snapToRoads?interpolate=true&path=${encodeURIComponent(path)}&key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" },
    );
    if (!res.ok) {
      console.warn(`[places] snapToRoads failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as SnapResponse;
    const out: [number, number][] = [];
    const offsets: number[] = [];
    for (const s of data.snappedPoints ?? []) {
      const lat = s.location?.latitude;
      const lng = s.location?.longitude;
      if (lat == null || lng == null) continue;
      out.push([lat, lng]);
      if (s.originalIndex != null && pts[s.originalIndex]) {
        offsets.push(metres(pts[s.originalIndex], { lat, lng }));
      }
    }
    return { path: out, offsets };
  } catch (e) {
    console.warn(`[places] snapToRoads error: ${(e as Error).name}`);
    return null;
  }
}

type RoutesResponse = { routes?: { polyline?: { encodedPolyline?: string } }[] };

function waypoint(p: DayPoint) {
  const location: { latLng: { latitude: number; longitude: number }; heading?: number } = {
    latLng: { latitude: p.lat, longitude: p.lng },
  };
  if (p.courseDeg != null && p.speed != null && p.speed >= 3) location.heading = Math.round(p.courseDeg) % 360;
  return { location };
}

/** One Compute Routes call: origin, ≤10 pass-through stops, destination.
 *  Traffic-unaware and ≤10 intermediates keeps it in the Essentials tier. */
async function routeRun(key: string, pts: DayPoint[]): Promise<[number, number][] | null> {
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: waypoint(pts[0]),
        destination: waypoint(pts[pts.length - 1]),
        intermediates: pts.slice(1, -1).map((p) => ({ ...waypoint(p), via: true })),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[places] computeRoutes failed: HTTP ${res.status}`);
      return null;
    }
    const enc = ((await res.json()) as RoutesResponse).routes?.[0]?.polyline?.encodedPolyline;
    // No route at all (nowhere near a road): an answer, just not a usable one.
    return enc ? decodePolyline(enc) : [];
  } catch (e) {
    console.warn(`[places] computeRoutes error: ${(e as Error).name}`);
    return null;
  }
}

/** Sparse drive via Routes. null = couldn't ask (limit, failure): don't cache. */
async function routedDrive(key: string, pts: DayPoint[]): Promise<TrackPath | null> {
  const runs = waypointRuns(pts);
  const path: [number, number][] = [];
  for (const run of runs) {
    if (!(await canCall("routes"))) return null;
    await bump("routes");
    const got = await routeRun(
      key,
      run.map((i) => pts[i]),
    );
    if (got == null) return null;
    if (got.length < 2) return raw(pts);
    path.push(...(path.length > 0 ? got.slice(1) : got));
  }
  const secs = (pts[pts.length - 1].at.getTime() - pts[0].at.getTime()) / 1000;
  return routeLooksRight(pts, path, secs) ? { path, snapped: true } : raw(pts);
}

async function roadSnapped(key: string, pts: DayPoint[]): Promise<TrackPath | null> {
  const chunks: DayPoint[][] = [];
  for (let i = 0; i < pts.length - 1; i += MAX_PER_CALL - 1) chunks.push(pts.slice(i, i + MAX_PER_CALL));

  const path: [number, number][] = [];
  const offsets: number[] = [];
  for (const chunk of chunks) {
    if (!(await canCall("roads"))) return null; // over today's limit: try again tomorrow
    await bump("roads");
    const got = await snapChunk(key, chunk);
    if (!got) return null; // failed: not cached, tried again next time
    path.push(...(path.length > 0 ? got.path.slice(1) : got.path));
    offsets.push(...got.offsets);
  }
  return snapLooksRight(offsets) && path.length >= 2 ? { path, snapped: true } : raw(pts);
}

let lastPurge = 0;

export async function snappedDrive(
  key: string | null,
  userId: string,
  pts: DayPoint[],
): Promise<TrackPath> {
  if (pts.length < 2) return raw(pts);
  const startAt = pts[0].at;
  const endAt = pts[pts.length - 1].at;
  const now = Date.now();

  if (now - lastPurge > 60 * 60_000) {
    lastPurge = now;
    await prisma.snappedPath.deleteMany({ where: { fetchedAt: { lt: new Date(now - KEEP_MS) } } });
  }

  const cached = (await prisma.snappedPath.findUnique({
    where: { userId_startAt_endAt: { userId, startAt, endAt } },
    select: { path: true, snapped: true, fetchedAt: true },
  })) as { path: unknown; snapped: boolean; fetchedAt: Date } | null;
  if (cached && now - cached.fetchedAt.getTime() < KEEP_MS && Array.isArray(cached.path)) {
    return { path: cached.path as [number, number][], snapped: cached.snapped };
  }
  if (!key) return raw(pts);

  const result = isSparse(pts) ? await routedDrive(key, pts) : await roadSnapped(key, pts);
  if (!result) return raw(pts);
  await prisma.snappedPath.upsert({
    where: { userId_startAt_endAt: { userId, startAt, endAt } },
    create: { userId, startAt, endAt, path: result.path, snapped: result.snapped },
    update: { path: result.path, snapped: result.snapped, fetchedAt: new Date(now) },
  });
  return result;
}
