import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { householdTz } from "@/lib/dates";
import { PLACES_LOOKUP_KEY } from "@/lib/places/config";
import { dayEnd, dayStart } from "@/lib/places/day-bounds";
import { MPS_TO_MPH, planDay, totalsOf, type DayPoint, type Leg } from "@/lib/places/day";
import { snappedDrive } from "@/lib/places/roads";
import { placeFor } from "@/lib/places/live";
import type { DayData, DayItem } from "@/lib/places/history-types";

/**
 * One person's day for the History page and today's tracks on the map:
 * stops (named, unless asked not to) and trips, with finished drives snapped
 * to roads. Everything Google returns is cached, so opening a day again costs
 * nothing.
 */

const MAX_POINTS = 6_000;
/** A drive this recent may still be going; it's drawn raw until it settles. */
const SETTLE_MS = 3 * 60_000;
const SELECT = { at: true, lat: true, lng: true, accuracyM: true, speed: true } as const;

export async function loadDay(userId: string, dateISO: string, opts: { names: boolean }): Promise<DayData> {
  const tz = householdTz();
  const start = dayStart(dateISO, tz);
  const end = dayEnd(dateISO, tz);

  const [points, before, key] = await Promise.all([
    prisma.locationPoint.findMany({
      where: { userId, at: { gte: start, lt: end } },
      orderBy: { at: "asc" },
      take: MAX_POINTS,
      select: SELECT,
    }) as Promise<DayPoint[]>,
    prisma.locationPoint.findFirst({
      where: { userId, at: { lt: start } },
      orderBy: { at: "desc" },
      select: SELECT,
    }) as Promise<DayPoint | null>,
    getSetting(PLACES_LOOKUP_KEY),
  ]);

  const plan = planDay(points, start, before);
  const now = Date.now();
  const items: DayItem[] = [];
  let n = 0;

  for (let i = 0; i < plan.items.length; i++) {
    const it = plan.items[i];
    if (it.kind === "stop") {
      n++;
      items.push({
        kind: "stop",
        n,
        start: it.start.toISOString(),
        end: it.end.toISOString(),
        lat: it.lat,
        lng: it.lng,
        place: opts.names ? await placeFor(it.lat, it.lng, 30, userId) : null,
      });
      continue;
    }
    const leg = it as Leg;
    const settled = i < plan.items.length - 1 && now - leg.end.getTime() > SETTLE_MS;
    const track =
      leg.kind === "drive" && settled
        ? await snappedDrive(key, userId, leg.points)
        : { path: leg.points.map((p) => [p.lat, p.lng] as [number, number]), snapped: false };
    items.push({
      kind: leg.kind,
      start: leg.start.toISOString(),
      end: leg.end.toISOString(),
      path: track.path,
      snapped: track.snapped,
      distanceM: Math.round(leg.distanceM),
      topMph: leg.topMps != null ? Math.round(leg.topMps * MPS_TO_MPH) : null,
      times: leg.points.map((p) => p.at.getTime()),
      raw: leg.points.map((p) => [p.lat, p.lng] as [number, number]),
    });
  }

  const t = totalsOf(plan);
  return {
    date: dateISO,
    items,
    totals: {
      miles: Math.round((t.distanceM / 1609.344) * 10) / 10,
      driveMin: Math.round(t.driveMs / 60_000),
      topMph: t.topMps != null ? Math.round(t.topMps * MPS_TO_MPH) : null,
      stops: t.stops,
    },
  };
}
