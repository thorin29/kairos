import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Where each Home Assistant zone really is, learned from the points phones
 * report while inside it: the median position over the last 60 days. People
 * in a zone are drawn there, so a family at home stacks into one marker
 * instead of scattering with GPS wobble. Worked out at most hourly.
 */

const WINDOW_DAYS = 60;
const MIN_POINTS = 5;
const REFRESH_MS = 60 * 60_000;

export type ZoneCenter = { lat: number; lng: number };

let cache: { at: number; centers: Map<string, ZoneCenter> } | null = null;

export async function zoneCenters(): Promise<Map<string, ZoneCenter>> {
  const now = Date.now();
  if (cache && now - cache.at < REFRESH_MS) return cache.centers;
  const since = new Date(now - WINDOW_DAYS * 24 * 60 * 60_000);
  const rows = (await prisma.$queryRaw`
    SELECT "zone",
           percentile_cont(0.5) WITHIN GROUP (ORDER BY "lat") AS lat,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY "lng") AS lng,
           count(*)::int AS n
    FROM "LocationPoint"
    WHERE "zone" IS NOT NULL AND "at" >= ${since}
      AND ("accuracyM" IS NULL OR "accuracyM" <= 100)
    GROUP BY "zone"`) as { zone: string; lat: number; lng: number; n: number }[];
  const centers = new Map<string, ZoneCenter>();
  for (const r of rows) {
    if (r.n >= MIN_POINTS) centers.set(r.zone, { lat: Number(r.lat), lng: Number(r.lng) });
  }
  cache = { at: now, centers };
  return centers;
}
