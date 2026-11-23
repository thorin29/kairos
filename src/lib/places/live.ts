import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { PLACES_MAP_ID, PLACES_MAP_KEY } from "@/lib/places/config";
import { presenceOf, STALE_MS, type TimedPt } from "@/lib/places/geo";
import { resolvePlace, type PlaceLabel } from "@/lib/places/resolve";
import { MPS_TO_MPH } from "@/lib/places/day";

/**
 * Everyone's current position for the Places page and the phone's API: the
 * newest point, whether they're moving, since when they've been where they
 * are, and that spot's name. Names are memoised briefly per spot, so polling
 * browsers cost a couple of small queries, never a Google call.
 */

export type { LivePerson, WaitingPerson, LiveData } from "@/lib/places/live-types";
import type { LivePerson, WaitingPerson, LiveData } from "@/lib/places/live-types";

const RECENT_MS = 24 * 60 * 60_000;
const RECENT_POINTS = 300;
const MEMO_MS = 10 * 60_000;
const memo = new Map<string, { label: PlaceLabel; at: number }>();

/** Forget memoised names (after the family names or corrects a place). */
export function bustPlaceMemo(): void {
  memo.clear();
}

export async function placeFor(
  lat: number,
  lng: number,
  accuracyM: number | null,
  userId: string | null,
): Promise<PlaceLabel> {
  const k = `${userId ?? "-"}:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = memo.get(k);
  const now = Date.now();
  if (hit && now - hit.at < MEMO_MS) return hit.label;
  const label = await resolvePlace({ lat, lng, accuracyM }, userId);
  memo.set(k, { label, at: now });
  if (memo.size > 500) {
    for (const [key, v] of memo) if (now - v.at >= MEMO_MS) memo.delete(key);
  }
  return label;
}

export async function loadLive(): Promise<LiveData> {
  const tracked = (await prisma.placesPerson.findMany({
    select: {
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          color: true,
          avatarPath: true,
          avatarPosition: true,
          isActive: true,
          sortOrder: true,
        },
      },
    },
  })) as {
    user: {
      id: string;
      name: string;
      displayName: string | null;
      color: string;
      avatarPath: string | null;
      avatarPosition: string;
      isActive: boolean;
      sortOrder: number;
    };
  }[];
  const users = tracked
    .map((t) => t.user)
    .filter((u) => u.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const now = Date.now();
  const people: LivePerson[] = [];
  const waiting: WaitingPerson[] = [];

  for (const u of users) {
    const base = {
      id: u.id,
      name: u.displayName || u.name,
      color: u.color,
      avatarPath: u.avatarPath,
      avatarPosition: u.avatarPosition,
    };
    let rows = (await prisma.locationPoint.findMany({
      where: { userId: u.id, at: { gte: new Date(now - RECENT_MS) } },
      orderBy: { at: "desc" },
      take: RECENT_POINTS,
      select: { at: true, lat: true, lng: true, accuracyM: true, speed: true, battery: true },
    })) as (TimedPt & { battery: number | null })[];
    if (rows.length === 0) {
      // Quiet for a day: the newest point ever is still where they are.
      rows = (await prisma.locationPoint.findMany({
        where: { userId: u.id },
        orderBy: { at: "desc" },
        take: 1,
        select: { at: true, lat: true, lng: true, accuracyM: true, speed: true, battery: true },
      })) as (TimedPt & { battery: number | null })[];
    }
    const pres = presenceOf(rows);
    if (!pres) {
      waiting.push(base);
      continue;
    }
    const latest = rows[0];
    const place = pres.moving ? null : await placeFor(latest.lat, latest.lng, latest.accuracyM, u.id);
    people.push({
      ...base,
      lat: latest.lat,
      lng: latest.lng,
      accuracyM: latest.accuracyM,
      at: latest.at.toISOString(),
      battery: latest.battery,
      mph: pres.moving && latest.speed != null ? Math.round(latest.speed * MPS_TO_MPH) : null,
      moving: pres.moving,
      since: pres.since ? pres.since.toISOString() : null,
      stale: now - latest.at.getTime() > STALE_MS,
      place,
    });
  }
  return { people, waiting, asOf: new Date(now).toISOString() };
}

/** What the browser map needs from settings. Null = Places isn't set up. */
export async function mapConfig(): Promise<{ mapKey: string; mapId: string } | null> {
  const [mapKey, mapId] = await Promise.all([getSetting(PLACES_MAP_KEY), getSetting(PLACES_MAP_ID)]);
  return mapKey && mapId ? { mapKey, mapId } : null;
}

/** Places shows in the nav once the map is configured and someone is tracked. */
export async function placesEnabled(): Promise<boolean> {
  const [cfg, n] = await Promise.all([mapConfig(), prisma.placesPerson.count()]);
  return cfg != null && n > 0;
}
