import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { PLACES_LOOKUP_KEY } from "@/lib/places/config";
import { boxAround, metres, shortAddress, type Pt } from "@/lib/places/geo";
import { nearbySearch, reverseGeocode, forwardGeocode } from "@/lib/places/google";
import { bump, canCall } from "@/lib/places/usage";

/**
 * Name the spot a person is at, as cheaply as possible:
 *   1. a saved address within SAVED_RADIUS_M ("Home", "Rink"),
 *   2. an answer Google already gave within CACHE_RADIUS_M (30 days),
 *   3. Google Nearby Search (a business or landmark), then
 *   4. Google reverse geocoding (the street address).
 * Steps 3–4 count against Kairos's daily limits; when those are used up the
 * place is just unnamed. Only called for people who are standing still.
 */

import type { PlaceLabel } from "@/lib/places/live-types";
export type { PlaceLabel };

const SAVED_RADIUS_M = 120;
const CACHE_RADIUS_M = 60;
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
    if (d <= CACHE_RADIUS_M && d < bestD) {
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

async function askGoogle(key: string, p: Pt & { accuracyM: number | null }): Promise<PlaceLabel> {
  const fuzzy = p.accuracyM != null && p.accuracyM > FUZZY_M;

  if (!fuzzy && (await canCall("nearby"))) {
    await bump("nearby");
    const radius = Math.min(80, Math.max(30, p.accuracyM ?? 40));
    const hits = await nearbySearch(key, p.lat, p.lng, radius);
    if (hits && hits.length > 0) {
      const hit = hits.reduce((a, b) => (metres(p, a) <= metres(p, b) ? a : b));
      await prisma.placeLookup.create({
        data: { lat: p.lat, lng: p.lng, name: hit.name, address: hit.address, googlePlaceId: hit.placeId, source: "nearby" },
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

export async function resolvePlace(p: Pt & { accuracyM: number | null }): Promise<PlaceLabel> {
  const now = Date.now();
  await purgeOld(now);
  const key = await getSetting(PLACES_LOOKUP_KEY);

  const saved = nearestSaved(p, await savedWithCoords(key, now));
  if (saved) return { name: saved.name, address: shortAddress(saved.address), kind: "saved" };

  const cached = await cachedNear(p, now);
  if (cached) return labelOf(cached);

  if (!key) return UNKNOWN;
  const k = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  const running = inflight.get(k);
  if (running) return running;
  const job = askGoogle(key, p).finally(() => inflight.delete(k));
  inflight.set(k, job);
  return job;
}
