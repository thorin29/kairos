import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { householdTz } from "@/lib/dates";
import { PLACES_LOOKUP_KEY } from "@/lib/places/config";
import { dayEnd, dayStart } from "@/lib/places/day-bounds";
import { MPS_TO_MPH, planDay, smoothPath, totalsOf, type DayPoint, type KnownPlace, type Leg } from "@/lib/places/day";
import { snappedDrive } from "@/lib/places/roads";
import { placeFor } from "@/lib/places/live";
import { zoneCenters, zoneNear } from "@/lib/places/zones";
import { applyEdits, type AddedStop, type StopEdit } from "@/lib/places/day-edits";
import { shortAddress } from "@/lib/places/geo";
import type { DayData, DayItem, DayRemovedStop } from "@/lib/places/history-types";
import { withWorkouts, type TrackedWorkout } from "@/lib/places/workout-legs";
import { tripDaysFor } from "@/lib/workouts/backpacking-trips";

/**
 * One person's day for the History page and today's tracks on the map:
 * stops (named, unless asked not to) and trips, with finished drives snapped
 * to roads. Everything Google returns is cached, so opening a day again costs
 * nothing.
 */

const MAX_POINTS = 6_000;
/** On a backpacking day, a stop this long outside any zone is camp (v0.778). */
const CAMP_MS = 2 * 60 * 60_000;
/** A drive this recent may still be going; it's drawn raw until it settles. */
const SETTLE_MS = 60_000;
const SELECT = { at: true, lat: true, lng: true, accuracyM: true, speed: true, zone: true, courseDeg: true, source: true } as const;

/** Saved addresses and the family's named spots (everyone's and this
 *  person's own), so a quick stop there still shows. */
async function knownPlaces(userId: string): Promise<KnownPlace[]> {
  const [saved, named] = await Promise.all([
    prisma.savedAddress.findMany({ where: { status: "APPROVED", lat: { not: null } }, select: { lat: true, lng: true } }) as Promise<
      { lat: number | null; lng: number | null }[]
    >,
    prisma.placeName.findMany({
      where: { name: { not: null }, OR: [{ userId: null }, { userId }] },
      select: { lat: true, lng: true, radiusM: true },
    }) as Promise<{ lat: number; lng: number; radiusM: number }[]>,
  ]);
  return [
    ...saved.flatMap((s) => (s.lat != null && s.lng != null ? [{ lat: s.lat, lng: s.lng, radiusM: 150 }] : [])),
    ...named,
  ];
}

/** `snap: false` (v0.795, the visit snapshot) skips Google road-snapping. */
export async function loadDay(userId: string, dateISO: string, opts: { names: boolean; snap?: boolean }): Promise<DayData> {
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

  const editRows = (await prisma.placesStopEdit.findMany({
    where: { userId, at: { gte: start, lt: end } },
    orderBy: { at: "asc" },
    select: { id: true, kind: true, at: true, lat: true, lng: true, name: true, address: true },
  })) as { id: string; kind: string; at: Date; lat: number | null; lng: number | null; name: string | null; address: string | null }[];
  const edits: StopEdit[] = editRows.flatMap((e): StopEdit[] =>
    e.kind === "remove"
      ? [{ id: e.id, kind: "remove", at: e.at }]
      : e.kind === "add" && e.lat != null && e.lng != null
        ? [{ id: e.id, kind: "add", at: e.at, lat: e.lat, lng: e.lng, name: e.name, address: e.address }]
        : [],
  );
  const known = await knownPlaces(userId);
  const now = Date.now();
  const edited = applyEdits(planDay(points, start, before, known, now), edits);
  const plan = edited.plan;
  const centers = await zoneCenters();
  // A backpacking trip day (v0.778): walking is hiking, long stops are camp.
  const trip = (await tripDaysFor(userId, dateISO, dateISO)).length > 0;
  const items: DayItem[] = [];
  let n = 0;

  for (let i = 0; i < plan.items.length; i++) {
    const it = plan.items[i];
    if (it.kind === "stop") {
      n++;
      const added = "editId" in it ? (it as AddedStop) : null;
      // In a zone by its points, or (v0.813.2) a few metres from a zone's
      // centre when the phone didn't report one.
      const zone = it.zone ?? (added ? null : zoneNear(centers, { lat: it.lat, lng: it.lng }));
      // A stop inside a zone is pinned at the zone's centre.
      const centre = zone ? centers.get(zone) : undefined;
      const lat = centre?.lat ?? it.lat;
      const lng = centre?.lng ?? it.lng;
      items.push({
        kind: "stop",
        n,
        start: it.start.toISOString(),
        end: it.end.toISOString(),
        lat,
        lng,
        place: added?.name
          ? { name: added.name, address: shortAddress(added.address), kind: "saved" }
          : trip && !added && !zone && it.end.getTime() - it.start.getTime() >= CAMP_MS
            ? { name: "Camp", address: null, kind: "saved" }
            : opts.names
            ? await placeFor(lat, lng, 30, userId, zone)
            : null,
        editId: added?.editId ?? null,
        zone,
        ...("lastSeen" in it && it.lastSeen ? { lastSeen: true } : {}),
      });
      continue;
    }
    const leg = it as Leg;
    const settled = i < plan.items.length - 1 && now - leg.end.getTime() > SETTLE_MS;
    const track =
      leg.kind === "drive" && settled && opts.snap !== false
        ? await snappedDrive(key, userId, leg.points)
        : { path: leg.points.map((p) => [p.lat, p.lng] as [number, number]), snapped: false };
    const secs = Math.max(1, (leg.end.getTime() - leg.start.getTime()) / 1000);
    const hiking = trip && leg.kind === "move";
    const motion = hiking
      ? "workout"
      : leg.kind === "drive"
        ? "drive"
        : (leg.distanceM / secs) * MPS_TO_MPH < 5
          ? "walk"
          : "move";
    items.push({
      kind: leg.kind,
      motion,
      ...(hiking ? { activity: "Backpacking" } : {}),
      start: leg.start.toISOString(),
      end: leg.end.toISOString(),
      // Raw reports (off-road, parking lots, walks) are softened for drawing;
      // replay still uses the reports themselves.
      path: track.snapped ? track.path : smoothPath(track.path),
      snapped: track.snapped,
      // Still under way (the day's last item): drawn faded until it ends.
      ...(leg.kind === "drive" && i === plan.items.length - 1 ? { live: true } : {}),
      distanceM: Math.round(leg.distanceM),
      topMph: leg.topMps != null ? Math.round(leg.topMps * MPS_TO_MPH) : null,
      times: leg.points.map((p) => p.at.getTime()),
      raw: leg.points.map((p) => [p.lat, p.lng] as [number, number]),
    });
  }

  // Two stops named the same, with only a short hop between, are one visit
  // (a big store whose two halves fell out as separate stops).
  for (let k = 0; k + 1 < items.length; ) {
    const a = items[k];
    const b = items[k + 1];
    if (a.kind === "stop" && b.kind === "stop" && !a.editId && !b.editId && a.place?.name != null && a.place.name === b.place?.name) {
      items.splice(k, 2, { ...a, end: b.end });
      continue;
    }
    k++;
  }
  for (let k = 0; k + 2 < items.length; ) {
    const a = items[k];
    const leg = items[k + 1];
    const b = items[k + 2];
    const same =
      a.kind === "stop" &&
      b.kind === "stop" &&
      leg.kind !== "stop" &&
      !a.editId &&
      !b.editId &&
      a.place?.name != null &&
      a.place.name === b.place?.name &&
      Date.parse(leg.end) - Date.parse(leg.start) <= 20 * 60_000 &&
      leg.distanceM <= 800;
    if (same && a.kind === "stop" && b.kind === "stop") {
      items.splice(k, 3, { ...a, end: b.end });
      continue;
    }
    k++;
  }
  const tracked = (await prisma.workoutTrack.findMany({
    where: { userId, startAt: { lt: end }, endAt: { gt: start } },
    orderBy: { startAt: "asc" },
    select: { activity: true, startAt: true, endAt: true, distanceM: true, path: true },
  })) as { activity: string; startAt: Date; endAt: Date; distanceM: number; path: unknown }[];
  const workouts: TrackedWorkout[] = tracked.map((w) => ({
    ...w,
    path: Array.isArray(w.path) ? (w.path as [number, number, number][]) : [],
  }));
  const shown = withWorkouts(items, workouts);

  let stopNo = 0;
  for (const it of shown) if (it.kind === "stop") it.n = ++stopNo;

  const removed: DayRemovedStop[] = [];
  for (const r of edited.removed) {
    removed.push({
      editId: r.editId,
      start: r.start.toISOString(),
      end: r.end.toISOString(),
      place: opts.names ? await placeFor(r.lat, r.lng, 30, userId, r.zone) : null,
    });
  }

  const t = totalsOf(plan);
  return {
    removed,
    date: dateISO,
    items: shown,
    lastSeen: before ? { lat: before.lat, lng: before.lng } : null,
    totals: {
      miles: Math.round((t.distanceM / 1609.344) * 10) / 10,
      driveMin: Math.round(t.driveMs / 60_000),
      topMph: t.topMps != null ? Math.round(t.topMps * MPS_TO_MPH) : null,
      stops: stopNo,
    },
  };
}
