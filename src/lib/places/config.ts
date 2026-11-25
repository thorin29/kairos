import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting, clearSetting } from "@/lib/settings";
import { hashToken } from "@/lib/auth";
import { householdTz } from "@/lib/dates";
import { cleanEntityId } from "@/lib/places/ingest-parse";
import { dayStart, dayEnd } from "@/lib/places/day-bounds";
import { firebaseClientConfig, pushStatus } from "@/lib/push";

/**
 * Places settings. Home Assistant pushes positions to the ingest route with a
 * token that Kairos generates, shows once, and keeps only as a SHA-256 hash.
 * The browser map key is public by design (locked to the site by Google); the
 * lookup key is used only on the server.
 */
export const PLACES_MAP_KEY = "places.mapKey";
export const PLACES_LOOKUP_KEY = "places.lookupKey";
/** Google Map ID — needed for the avatar markers; not a secret. */
export const PLACES_MAP_ID = "places.mapId";
export const PLACES_TOKEN_HASH = "places.ingestTokenHash";
export const PLACES_TOKEN_AT = "places.ingestTokenCreatedAt";
/** The last entity that pushed without being linked to anyone, as JSON. */
export const PLACES_UNLINKED = "places.unlinked";

export async function verifyIngestToken(given: string | null): Promise<boolean> {
  if (!given) return false;
  const stored = await getSetting(PLACES_TOKEN_HASH);
  if (!stored) return false;
  const a = Buffer.from(hashToken(given));
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Make a new token, replacing any old one. Returns it in the clear — the only
 *  time it exists outside Home Assistant. */
export async function createIngestToken(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await setSetting(PLACES_TOKEN_HASH, hashToken(token));
  await setSetting(PLACES_TOKEN_AT, new Date().toISOString());
  return token;
}

export async function noteUnlinked(entityId: string): Promise<void> {
  await setSetting(PLACES_UNLINKED, JSON.stringify({ entityId, at: new Date().toISOString() }));
}

export async function saveKeys(input: {
  mapKey: string;
  lookupKey: string;
  mapId: string;
  clearMap?: boolean;
  clearLookup?: boolean;
}): Promise<void> {
  const clean = (s: string) => s.trim().slice(0, 200);
  if (clean(input.mapKey)) await setSetting(PLACES_MAP_KEY, clean(input.mapKey));
  else if (input.clearMap) await clearSetting(PLACES_MAP_KEY);
  if (clean(input.lookupKey)) await setSetting(PLACES_LOOKUP_KEY, clean(input.lookupKey));
  else if (input.clearLookup) await clearSetting(PLACES_LOOKUP_KEY);
  const mapId = input.mapId.trim().slice(0, 100);
  if (mapId) await setSetting(PLACES_MAP_ID, mapId);
  else await clearSetting(PLACES_MAP_ID);
}

/** Link people to HA entities. A blank entity stops tracking that person
 *  (their history stays until deleted). */
export async function savePeople(
  rows: { userId: string; entityId: string }[],
): Promise<{ error: string | null }> {
  const seen = new Map<string, string>();
  const wanted: { userId: string; entityId: string | null }[] = [];
  for (const r of rows) {
    const raw = r.entityId.trim();
    if (!raw) {
      wanted.push({ userId: r.userId, entityId: null });
      continue;
    }
    const id = cleanEntityId(raw);
    if (!id) return { error: `"${raw}" isn't an entity id, like person.alex.` };
    if (seen.has(id)) return { error: `${id} is set for two people.` };
    seen.set(id, r.userId);
    wanted.push({ userId: r.userId, entityId: id });
  }

  await prisma.$transaction(async (tx) => {
    // Clear first so swapping two people's entities doesn't trip the unique key.
    await tx.placesPerson.deleteMany({ where: { userId: { in: wanted.map((w) => w.userId) } } });
    const data = wanted
      .filter((w): w is { userId: string; entityId: string } => w.entityId != null)
      .map((w) => ({ userId: w.userId, entityId: w.entityId }));
    if (data.length > 0) {
      await tx.placesPerson.deleteMany({ where: { entityId: { in: data.map((d) => d.entityId) } } });
      await tx.placesPerson.createMany({ data });
    }
  });
  return { error: null };
}

/** Delete history for one person or everyone, optionally between two
 *  household dates (inclusive). Returns how many points went. */
export async function deleteHistory(input: {
  userId: string | null;
  from: string | null;
  to: string | null;
}): Promise<number> {
  const tz = householdTz();
  const at: { gte?: Date; lt?: Date } = {};
  if (input.from) at.gte = dayStart(input.from, tz);
  if (input.to) at.lt = dayEnd(input.to, tz);
  const res = await prisma.locationPoint.deleteMany({
    where: {
      ...(input.userId ? { userId: input.userId } : {}),
      ...(at.gte || at.lt ? { at } : {}),
    },
  });
  return res.count;
}

export type PlacesPersonRow = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string;
  entityId: string;
  points: number;
  last: {
    at: string;
    accuracyM: number | null;
    speed: number | null;
    battery: number | null;
  } | null;
};

export type PlacesAdmin = {
  mapKeySet: boolean;
  lookupKeySet: boolean;
  mapId: string;
  tokenCreatedAt: string | null;
  lastReceivedAt: string | null;
  unlinked: { entityId: string; at: string } | null;
  totalPoints: number;
  storageBytes: number;
  /** The Places page's visit records (v0.795). */
  visitStore: { visits: number; places: number; bytes: number; error: { day: string; message: string } | null };
  people: PlacesPersonRow[];
  named: { id: string; name: string; address: string | null; who: string | null; lat: number; lng: number; createdAt: string }[];
  rules: { id: string; tell: string[]; about: string | null; place: string; onArrive: boolean; onLeave: boolean }[];
  placeOptions: { value: string; label: string }[];
  firebase: { projectId: string; applicationId: string; apiKey: string; senderId: string } | null;
  push: { firebase: boolean; devices: number; waiting: number };
};

export async function loadPlacesAdmin(): Promise<PlacesAdmin> {
  const [mapKey, lookupKey, mapId, tokenHash, tokenAt, unlinkedRaw] = await Promise.all([
    getSetting(PLACES_MAP_KEY),
    getSetting(PLACES_LOOKUP_KEY),
    getSetting(PLACES_MAP_ID),
    getSetting(PLACES_TOKEN_HASH),
    getSetting(PLACES_TOKEN_AT),
    getSetting(PLACES_UNLINKED),
  ]);

  const users = (await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      avatarPath: true,
      avatarPosition: true,
      placesPerson: { select: { entityId: true } },
    },
  })) as {
    id: string;
    name: string;
    displayName: string | null;
    color: string;
    avatarPath: string | null;
    avatarPosition: string;
    placesPerson: { entityId: string } | null;
  }[];

  const grouped = await prisma.locationPoint.groupBy({
    by: ["userId"],
    _count: { _all: true },
  });
  const counts = grouped.map((g) => ({ userId: g.userId, n: g._count._all }));
  const countOf = new Map(counts.map((c) => [c.userId, c.n]));

  const people: PlacesPersonRow[] = [];
  for (const u of users) {
    const last = (await prisma.locationPoint.findFirst({
      where: { userId: u.id },
      orderBy: { at: "desc" },
      select: { at: true, accuracyM: true, speed: true, battery: true },
    })) as { at: Date; accuracyM: number | null; speed: number | null; battery: number | null } | null;
    people.push({
      id: u.id,
      name: u.displayName || u.name,
      color: u.color,
      avatarPath: u.avatarPath,
      avatarPosition: u.avatarPosition,
      entityId: u.placesPerson?.entityId ?? "",
      points: countOf.get(u.id) ?? 0,
      last: last
        ? { at: last.at.toISOString(), accuracyM: last.accuracyM, speed: last.speed, battery: last.battery }
        : null,
    });
  }

  const newest = (await prisma.locationPoint.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })) as { createdAt: Date } | null;

  const sizeRows = (await prisma.$queryRaw`SELECT pg_total_relation_size('"LocationPoint"')::bigint AS bytes`) as {
    bytes: bigint | number;
  }[];

  let unlinked: PlacesAdmin["unlinked"] = null;
  try {
    const u = unlinkedRaw ? JSON.parse(unlinkedRaw) : null;
    if (u && typeof u.entityId === "string" && typeof u.at === "string") unlinked = u;
  } catch {
    unlinked = null;
  }
  // Once it's linked, the hint has done its job.
  if (unlinked && people.some((p) => p.entityId === unlinked!.entityId)) unlinked = null;

  const namedRows = (await prisma.placeName.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    where: { name: { not: null } },
    select: { id: true, name: true, address: true, lat: true, lng: true, createdAt: true, user: { select: { name: true, displayName: true } } },
  })) as {
    id: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
    createdAt: Date;
    user: { name: string; displayName: string | null } | null;
  }[];

  const saved = (await prisma.savedAddress.findMany({
    where: { status: "APPROVED" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })) as { id: string; name: string }[];
  const ruleRows = (await prisma.placesNotifyRule.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      tellUserIds: true,
      aboutUserId: true,
      onArrive: true,
      onLeave: true,
      zone: true,
      placeName: { select: { name: true } },
      savedAddress: { select: { name: true } },
    },
  })) as {
    id: string;
    tellUserIds: unknown;
    aboutUserId: string | null;
    onArrive: boolean;
    onLeave: boolean;
    zone: string | null;
    placeName: { name: string | null } | null;
    savedAddress: { name: string } | null;
  }[];
  const zoneRows = (await prisma.locationPoint.findMany({
    where: { zone: { not: null }, at: { gte: new Date(Date.now() - 60 * 24 * 60 * 60_000) } },
    distinct: ["zone"],
    select: { zone: true },
    take: 50,
  })) as { zone: string | null }[];
  const zones = [...new Set(zoneRows.map((z) => z.zone).filter((z): z is string => Boolean(z)))].sort();
  const nameOf = new Map(users.map((u) => [u.id, u.displayName || u.name]));
  const [firebase, push] = await Promise.all([firebaseClientConfig(), pushStatus()]);

  return {
    named: namedRows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      who: r.user ? r.user.displayName || r.user.name : null,
      lat: r.lat,
      lng: r.lng,
      createdAt: r.createdAt.toISOString(),
    })),
    rules: ruleRows.map((r) => ({
      id: r.id,
      tell: (Array.isArray(r.tellUserIds) ? (r.tellUserIds as unknown[]) : [])
        .filter((x): x is string => typeof x === "string")
        .map((id) => nameOf.get(id) ?? "Someone"),
      about: r.aboutUserId ? nameOf.get(r.aboutUserId) ?? "Someone" : null,
      place: r.zone ? `${r.zone} (zone)` : r.placeName ? r.placeName.name ?? "Unnamed spot" : r.savedAddress?.name ?? "A place",
      onArrive: r.onArrive,
      onLeave: r.onLeave,
    })),
    placeOptions: [
      ...zones.map((z) => ({ value: `z:${z}`, label: `${z} (Home Assistant zone)` })),
      ...namedRows.filter((r) => r.name).map((r) => ({
        value: `n:${r.id}`,
        label: r.user ? `${r.name} (${r.user.displayName || r.user.name})` : (r.name as string),
      })),
      ...saved.map((a) => ({ value: `s:${a.id}`, label: a.name })),
    ],
    firebase,
    push,
    mapKeySet: Boolean(mapKey),
    lookupKeySet: Boolean(lookupKey),
    mapId: mapId ?? "",
    tokenCreatedAt: tokenHash ? tokenAt ?? null : null,
    lastReceivedAt: newest ? newest.createdAt.toISOString() : null,
    unlinked,
    totalPoints: counts.reduce((sum, c) => sum + c.n, 0),
    storageBytes: Number(sizeRows[0]?.bytes ?? 0),
    // Imported here, not at the top: visits → history → config would loop.
    visitStore: await (await import("@/lib/places/visits")).visitStorage(),
    people,
  };
}
