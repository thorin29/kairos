import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { PLACES_LOOKUP_KEY } from "@/lib/places/config";
import { boxAround, metres, shortAddress, type Pt } from "@/lib/places/geo";
import { isMinorPlace, nearbySearch, reverseGeocode, forwardGeocode } from "@/lib/places/google";
import { bump, canCall } from "@/lib/places/usage";
import { zoneCenters } from "@/lib/places/zones";
import { sameStreetAddress } from "@/lib/places/address-match";

/**
 * Name the spot a person is at, as cheaply as possible:
 *   0. a spot the family named (PlaceName) — this person's own first, then
 *      everyone's,
 *   1. a saved address within SAVED_RADIUS_M ("Home", "Rink"),
 *   2. an answer Google already gave within CACHE_RADIUS_M (30 days),
 *   3. Google Nearby Search (a business or landmark), then
 *   4. Google reverse geocoding (the street address).
 * Steps 3–4 count against Kairos's daily limits; when those are used up the
 * place is just unnamed. Only called for people who are standing still.
 */

import type { PlaceLabel } from "@/lib/places/live-types";
export type { PlaceLabel };

const SAVED_RADIUS_M = 150;
/** A report with no zone this close to a zone's learned centre counts as in
 *  it (older points, phones whose update missed the zone). */
const ZONE_NEAR_M = 60;
/** Nearby Search area: wide enough to reach a big store's centre from its
 *  aisles or garden centre, still nearest-first. */
function searchRadius(accuracyM: number | null): number {
  return Math.min(150, Math.max(60, (accuracyM ?? 40) * 2));
}
/** How close a cached Google answer must be to be reused: tight for a business
 *  (neighbouring shops), tighter for a street address (the house across the
 *  street). This is reuse distance, not the search area. */
const CACHE_PLACE_M = 30;
const CACHE_ADDRESS_M = 25;
const CACHE_RADIUS_M = Math.max(CACHE_PLACE_M, CACHE_ADDRESS_M);
/** Too fuzzy to pick a business; fall back to the street address. */
const FUZZY_M = 150;
/** Google lets geocoded coordinates be kept 30 days. */
const KEEP_MS = 30 * 24 * 60 * 60_000;
/** A saved address Google couldn't find is retried after this long. */
const RETRY_MISS_MS = 7 * 24 * 60 * 60_000;
/** Saved addresses geocoded per request at most, so a page never waits long. */
const GEOCODE_PER_CALL = 3;

const UNKNOWN: PlaceLabel = { name: null, address: null, kind: "unknown" };

type Saved = { id: string; name: string; address: string; lat: number | null; lng: number | null; geocodedAt: Date | null };

let lastPurge = 0;

/** Drop anything older than Google's 30-day caching limit. At most hourly. */
async function purgeOld(now: number): Promise<void> {
  if (now - lastPurge < 60 * 60_000) return;
  lastPurge = now;
  const cutoff = new Date(now - KEEP_MS);
  await prisma.placeLookup.deleteMany({ where: { fetchedAt: { lt: cutoff } } });
  await prisma.savedAddress.updateMany({
    where: { geocodedAt: { lt: cutoff }, lat: { not: null } },
    data: { lat: null, lng: null, geocodedAt: null },
  });
}

/** Approved saved addresses with coordinates, geocoding a few missing ones. */
async function savedWithCoords(key: string | null, now: number): Promise<Saved[]> {
  const rows = (await prisma.savedAddress.findMany({
    where: { status: "APPROVED" },
    select: { id: true, name: true, address: true, lat: true, lng: true, geocodedAt: true },
  })) as Saved[];
  if (!key) return rows;

  let budget = GEOCODE_PER_CALL;
  for (const r of rows) {
    if (budget === 0) break;
    const needs =
      r.lat == null
        ? !r.geocodedAt || now - r.geocodedAt.getTime() > RETRY_MISS_MS
        : !r.geocodedAt || now - r.geocodedAt.getTime() > KEEP_MS;
    if (!needs || !(await canCall("geocode"))) continue;
    budget--;
    await bump("geocode");
    const g = await forwardGeocode(key, r.address);
    if (!g) continue; // call failed: try again next time
    const data = g.found
      ? { lat: g.lat, lng: g.lng, geocodedAt: new Date(now) }
      : { lat: null, lng: null, geocodedAt: new Date(now) };
    await prisma.savedAddress.update({ where: { id: r.id }, data });
    Object.assign(r, data);
  }
  return rows;
}

function nearestSaved(p: Pt, rows: Saved[]): Saved | null {
  let best: Saved | null = null;
  let bestD = Infinity;
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    const d = metres(p, { lat: r.lat, lng: r.lng });
    if (d <= SAVED_RADIUS_M && d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

type Lookup = { lat: number; lng: number; name: string | null; address: string | null; source: string };

async function cachedNear(p: Pt, now: number): Promise<Lookup | null> {
  const b = boxAround(p, CACHE_RADIUS_M);
  const rows = (await prisma.placeLookup.findMany({
    where: {
      lat: { gte: b.minLat, lte: b.maxLat },
      lng: { gte: b.minLng, lte: b.maxLng },
      fetchedAt: { gte: new Date(now - KEEP_MS) },
    },
    select: { lat: true, lng: true, name: true, address: true, source: true },
    take: 50,
  })) as Lookup[];
  let best: Lookup | null = null;
  let bestD = Infinity;
  for (const r of rows) {
    const d = metres(p, r);
    const reach = r.source === "nearby" ? CACHE_PLACE_M : CACHE_ADDRESS_M;
    if (d <= reach && d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

function labelOf(l: Lookup): PlaceLabel {
  if (l.source === "nearby" && l.name) return { name: l.name, address: shortAddress(l.address), kind: "place" };
  if (l.address) return { name: null, address: shortAddress(l.address), kind: "address" };
  return UNKNOWN;
}

/** Ask Google once per spot even if several browsers poll at the same moment. */
const inflight = new Map<string, Promise<PlaceLabel>>();

async function askGoogle(
  key: string,
  p: Pt & { accuracyM: number | null },
  addressOnly = false,
): Promise<PlaceLabel> {
  const fuzzy = p.accuracyM != null && p.accuracyM > FUZZY_M;

  if (!addressOnly && !fuzzy && (await canCall("nearby"))) {
    await bump("nearby");
    const radius = searchRadius(p.accuracyM);
    const hits = await nearbySearch(key, p.lat, p.lng, radius);
    if (hits && hits.length > 0) {
      // Nearest place someone would go to; a charger or ATM only if that's all.
      const real = hits.filter((h) => !isMinorPlace(h));
      const pool = real.length > 0 ? real : hits;
      const hit = pool.reduce((a, b) => (metres(p, a) <= metres(p, b) ? a : b));
      await prisma.placeLookup.create({
        data: {
          lat: p.lat,
          lng: p.lng,
          name: hit.name,
          address: hit.address,
          googlePlaceId: hit.placeId,
          source: "nearby",
          candidates: [...real, ...hits.filter((h) => isMinorPlace(h))].slice(0, 6).map((h) => ({ name: h.name, address: h.address })),
        },
      });
      return { name: hit.name, address: shortAddress(hit.address), kind: "place" };
    }
  }

  if (await canCall("geocode")) {
    await bump("geocode");
    const rev = await reverseGeocode(key, p.lat, p.lng);
    if (rev) {
      await prisma.placeLookup.create({
        data: {
          lat: p.lat,
          lng: p.lng,
          name: null,
          address: rev.address,
          googlePlaceId: rev.placeId,
          source: rev.address ? "geocode" : "none",
        },
      });
      return rev.address ? { name: null, address: shortAddress(rev.address), kind: "address" } : UNKNOWN;
    }
  }
  return UNKNOWN;
}

type Named = { id: string; name: string; address: string | null; lat: number; lng: number; radiusM: number; userId: string | null };

/** The family's own name for this spot: this person's first, then everyone's. */
async function namedNear(p: Pt, userId: string | null): Promise<Named | null> {
  const b = boxAround(p, 500);
  const rows = (await prisma.placeName.findMany({
    where: {
      lat: { gte: b.minLat, lte: b.maxLat },
      lng: { gte: b.minLng, lte: b.maxLng },
      name: { not: null },
      OR: [{ userId: null }, ...(userId ? [{ userId }] : [])],
    },
    select: { id: true, name: true, address: true, lat: true, lng: true, radiusM: true, userId: true },
    take: 100,
  })) as Named[];
  let best: Named | null = null;
  let bestScore = Infinity;
  for (const r of rows) {
    const d = metres(p, r);
    if (d > r.radiusM) continue;
    // A person's own spot beats a shared one; then nearest wins.
    const score = d - (r.userId ? 10_000 : 0);
    if (score < bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

async function withGoogle(key: string | null, p: Pt & { accuracyM: number | null }, addressOnly: boolean): Promise<PlaceLabel> {
  if (!key) return UNKNOWN;
  const k = `${addressOnly ? "a" : "p"}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  const running = inflight.get(k);
  if (running) return running;
  const job = askGoogle(key, p, addressOnly).finally(() => inflight.delete(k));
  inflight.set(k, job);
  return job;
}

/** The saved address whose street address is the one Google gave, if any. */
function savedByAddress(address: string | null, rows: Saved[]): Saved | null {
  if (!address) return null;
  return rows.find((r) => sameStreetAddress(r.address, address)) ?? null;
}

/** A Google answer, named by the family's saved address when it's the same address. */
function preferSaved(label: PlaceLabel, rows: Saved[]): PlaceLabel {
  const saved = savedByAddress(label.address, rows);
  return saved ? { name: saved.name, address: shortAddress(saved.address), kind: "saved" } : label;
}

async function learnedZone(p: Pt): Promise<string | null> {
  let best: string | null = null;
  let bestD = ZONE_NEAR_M;
  for (const [zone, c] of await zoneCenters()) {
    const d = metres(p, c);
    if (d <= bestD) {
      best = zone;
      bestD = d;
    }
  }
  return best;
}

export async function resolvePlace(
  p: Pt & { accuracyM: number | null },
  userId: string | null = null,
  zone: string | null = null,
): Promise<PlaceLabel> {
  const now = Date.now();
  await purgeOld(now);
  const key = await getSetting(PLACES_LOOKUP_KEY);

  const named = await namedNear(p, userId);
  if (named) return { name: named.name, address: shortAddress(named.address), kind: "saved" };
  // Home Assistant says they're in a zone (its boundaries and home-network
  // detection), or the spot is at a zone's learned centre: that's the name.
  const inZone = zone ?? (await learnedZone(p));
  if (inZone) return { name: inZone, address: null, kind: "saved" };

  const cached = await cachedNear(p, now);

  const savedRows = await savedWithCoords(key, now);
  const saved = nearestSaved(p, savedRows);
  if (saved) return { name: saved.name, address: shortAddress(saved.address), kind: "saved" };
  // A big venue's saved address can be geocoded far from where people stand
  // in it; the same street address from Google still means that place.
  if (cached) return preferSaved(labelOf(cached), savedRows);
  return preferSaved(await withGoogle(key, p, false), savedRows);
}

export type Candidate = { name: string; address: string | null };

/** Nearby businesses for "Not right?". Uses what Google already returned for
 *  this spot; asks once more only if nothing is cached (within today's limit). */
export async function candidatesNear(p: Pt & { accuracyM: number | null }): Promise<Candidate[]> {
  const now = Date.now();
  const b = boxAround(p, CACHE_RADIUS_M);
  const rows = (await prisma.placeLookup.findMany({
    where: {
      lat: { gte: b.minLat, lte: b.maxLat },
      lng: { gte: b.minLng, lte: b.maxLng },
      fetchedAt: { gte: new Date(now - KEEP_MS) },
      source: "nearby",
    },
    select: { lat: true, lng: true, candidates: true },
    take: 50,
  })) as { lat: number; lng: number; candidates: unknown }[];
  const near = rows
    .filter((r) => metres(p, r) <= CACHE_RADIUS_M && Array.isArray(r.candidates))
    .sort((a, b2) => metres(p, a) - metres(p, b2))[0];
  if (near) return near.candidates as Candidate[];

  const key = await getSetting(PLACES_LOOKUP_KEY);
  if (!key || !(await canCall("nearby"))) return [];
  await bump("nearby");
  const radius = searchRadius(p.accuracyM);
  const hits = await nearbySearch(key, p.lat, p.lng, radius);
  if (!hits || hits.length === 0) return [];
  const candidates = hits.slice(0, 5).map((h) => ({ name: h.name, address: h.address }));
  await prisma.placeLookup.create({
    data: {
      lat: p.lat,
      lng: p.lng,
      name: hits[0].name,
      address: hits[0].address,
      googlePlaceId: hits[0].placeId,
      source: "nearby",
      candidates,
    },
  });
  return candidates;
}
