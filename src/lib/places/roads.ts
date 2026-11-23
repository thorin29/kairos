import "server-only";
import { prisma } from "@/lib/prisma";
import { metres } from "@/lib/places/geo";
import { snapLooksRight, type DayPoint } from "@/lib/places/day";
import { bump, canCall } from "@/lib/places/usage";

/**
 * Finished drives snapped to roads with Google's Roads API (snapToRoads with
 * interpolation, so curves between reports follow the road). Asked once per
 * drive and cached 30 days. A drive still under way, or one Google can't snap
 * believably, is drawn from the raw points.
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

  const chunks: DayPoint[][] = [];
  for (let i = 0; i < pts.length - 1; i += MAX_PER_CALL - 1) chunks.push(pts.slice(i, i + MAX_PER_CALL));

  const path: [number, number][] = [];
  const offsets: number[] = [];
  for (const chunk of chunks) {
    if (!(await canCall("roads"))) return raw(pts); // over today's limit: try again tomorrow
    await bump("roads");
    const got = await snapChunk(key, chunk);
    if (!got) return raw(pts); // failed: not cached, tried again next time
    path.push(...(path.length > 0 ? got.path.slice(1) : got.path));
    offsets.push(...got.offsets);
  }

  const result: TrackPath = snapLooksRight(offsets) && path.length >= 2 ? { path, snapped: true } : raw(pts);
  await prisma.snappedPath.upsert({
    where: { userId_startAt_endAt: { userId, startAt, endAt } },
    create: { userId, startAt, endAt, path: result.path, snapped: result.snapped },
    update: { path: result.path, snapped: result.snapped, fetchedAt: new Date(now) },
  });
  return result;
}
