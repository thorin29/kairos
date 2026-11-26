import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";
import { boxAround, metres, shortAddress, type Pt } from "@/lib/places/geo";
import { loadDay } from "@/lib/places/history";
import type { DayStopItem } from "@/lib/places/history-types";
import { placeType, typeLabel, typeRadiusM, type PlacesListRow, type PlaceVisitRow, type VisitSearch } from "@/lib/places/visits-types";
import { getSetting } from "@/lib/settings";

/**
 * Places page (v0.795): every stop is kept as a visit — to a place the family
 * confirmed (PlaceName), a Home Assistant zone, or a spot nobody has confirmed
 * yet (PlaceSpot). Search reads these rows only; it never asks Google.
 *
 * Finished days are written by the background timer, oldest missing first, a
 * few per run, so all past history fills in on its own. A correction to a day
 * writes that day again. Google's name for an unconfirmed spot is kept only
 * while its lookup is under 30 days old (Google's caching limit); confirming
 * makes the family's choice a PlaceName, kept for good.
 */

/** Place sizes on the confirm page: neighbouring shops need Small. */
export const SIZES = { small: 60, normal: 120, large: 250 } as const;
/** Two places this close in distance from a stop are a toss-up: "Which one?". */
const TIE_M = 25;
/** An unconfirmed stop this close to an existing spot is the same spot. */
const SPOT_M = 50;
/** Google lets its answers be kept 30 days. */
const KEEP_MS = 30 * 24 * 60 * 60_000;
/** Days written per timer run (each reads one person's day). */
const PER_TICK = 6;
const PAGE = 50;

type NameRow = { id: string; lat: number; lng: number; radiusM: number; userId: string | null };

async function namesNear(p: Pt, userId: string): Promise<NameRow[]> {
  const b = boxAround(p, 300);
  return (await prisma.placeName.findMany({
    where: {
      name: { not: null },
      OR: [{ userId: null }, { userId }],
      lat: { gte: b.minLat, lte: b.maxLat },
      lng: { gte: b.minLng, lte: b.maxLng },
    },
    select: { id: true, lat: true, lng: true, radiusM: true, userId: true },
  })) as NameRow[];
}

/** The confirmed place a stop belongs to, and a second one when it's a toss-up. */
export function pickPlace(rows: NameRow[], p: Pt): { placeNameId: string | null; altPlaceNameId: string | null } {
  const inside = rows
    .map((r) => ({ r, d: metres(p, { lat: r.lat, lng: r.lng }) }))
    .filter((x) => x.d <= x.r.radiusM)
    .sort((a, b) => a.d - b.d);
  if (inside.length === 0) return { placeNameId: null, altPlaceNameId: null };
  const alt = inside.length > 1 && inside[1].d - inside[0].d < TIE_M ? inside[1].r.id : null;
  return { placeNameId: inside[0].r.id, altPlaceNameId: alt };
}

/** The newest Google answer for a spot that's still within 30 days. */
async function lookupNear(p: Pt, withinM = 30): Promise<{ name: string | null; address: string | null; placeId: string | null; at: Date } | null> {
  const b = boxAround(p, withinM);
  const rows = (await prisma.placeLookup.findMany({
    where: {
      lat: { gte: b.minLat, lte: b.maxLat },
      lng: { gte: b.minLng, lte: b.maxLng },
      fetchedAt: { gte: new Date(Date.now() - KEEP_MS) },
      source: { not: "none" },
    },
    orderBy: { fetchedAt: "desc" },
    take: 5,
    select: { lat: true, lng: true, name: true, address: true, googlePlaceId: true, fetchedAt: true },
  })) as { lat: number; lng: number; name: string | null; address: string | null; googlePlaceId: string | null; fetchedAt: Date }[];
  const near = rows.filter((r) => metres(p, r) <= withinM).sort((a, b) => metres(p, a) - metres(p, b))[0];
  return near ? { name: near.name, address: near.address, placeId: near.googlePlaceId, at: near.fetchedAt } : null;
}

/**
 * An unnamed spot takes the name Google gave once History or the live map
 * looked it up there (v0.812.1). The overnight snapshot never asks Google
 * itself, so a spot made before anyone opened that day stayed unnamed.
 */
async function nameSpotLater(s: { id: string; lat: number; lng: number }): Promise<{ label: string; address: string | null; labelAt: Date } | null> {
  const g = await lookupNear(s, SPOT_M);
  if (!g?.name) return null;
  await prisma.placeSpot.update({
    where: { id: s.id },
    data: { label: g.name, address: g.address, googlePlaceId: g.placeId, labelAt: g.at },
  });
  return { label: g.name, address: g.address, labelAt: g.at };
}

/** The unconfirmed spot for a stop: the nearest one close by, or a new one. */
async function spotFor(p: Pt, typed: { name: string | null; address: string | null } | null): Promise<string> {
  const b = boxAround(p, SPOT_M);
  const near = (await prisma.placeSpot.findMany({
    where: { lat: { gte: b.minLat, lte: b.maxLat }, lng: { gte: b.minLng, lte: b.maxLng } },
    select: { id: true, lat: true, lng: true, label: true },
  })) as { id: string; lat: number; lng: number; label: string | null }[];
  const hit = near.map((s) => ({ s, d: metres(p, s) })).filter((x) => x.d <= SPOT_M).sort((a, b) => a.d - b.d)[0];
  if (hit) {
    if (typed?.name && !hit.s.label) {
      await prisma.placeSpot.update({ where: { id: hit.s.id }, data: { label: typed.name, address: typed.address, labelAt: null } });
    } else if (!hit.s.label) {
      await nameSpotLater(hit.s);
    }
    return hit.s.id;
  }
  const g = typed?.name ? null : await lookupNear(p);
  const row = await prisma.placeSpot.create({
    data: {
      lat: p.lat,
      lng: p.lng,
      label: typed?.name ?? g?.name ?? null,
      address: typed?.name ? typed.address : (g?.address ?? null),
      googlePlaceId: g?.placeId ?? null,
      // The family typed it (an added stop): theirs to keep.
      labelAt: typed?.name ? null : (g?.at ?? null),
    },
    select: { id: true },
  });
  return row.id;
}

/** Write one person's finished day as visits (again, if it was written). */
export async function snapshotDay(userId: string, dayISO: string): Promise<number> {
  const day = await loadDay(userId, dayISO, { names: false, snap: false });
  const stops = day.items.filter((i): i is DayStopItem => i.kind === "stop" && !i.lastSeen);
  const dayCol = toDateColumn(dayISO);
  const pinned = (await prisma.placeVisit.findMany({
    where: { userId, day: dayCol, pinned: true },
    select: { arrivedAt: true },
  })) as { arrivedAt: Date }[];

  const rows: {
    userId: string;
    day: Date;
    arrivedAt: Date;
    leftAt: Date;
    lat: number;
    lng: number;
    zone: string | null;
    placeNameId: string | null;
    altPlaceNameId: string | null;
    spotId: string | null;
  }[] = [];
  for (const s of stops) {
    const arrivedAt = new Date(s.start);
    // A visit moved by hand stays as it was.
    if (pinned.some((v) => Math.abs(v.arrivedAt.getTime() - arrivedAt.getTime()) < 10 * 60_000)) continue;
    const p = { lat: s.lat, lng: s.lng };
    let placeNameId: string | null = null;
    let altPlaceNameId: string | null = null;
    let spotId: string | null = null;
    if (!s.zone) {
      ({ placeNameId, altPlaceNameId } = pickPlace(await namesNear(p, userId), p));
      if (!placeNameId) {
        const typed = s.editId && s.place?.name ? { name: s.place.name, address: s.place.address ?? null } : null;
        spotId = await spotFor(p, typed);
      }
    }
    rows.push({
      userId,
      day: dayCol,
      arrivedAt,
      leftAt: new Date(s.end),
      lat: s.lat,
      lng: s.lng,
      zone: s.zone ?? null,
      placeNameId,
      altPlaceNameId,
      spotId,
    });
  }
  await prisma.$transaction([
    prisma.placeVisit.deleteMany({ where: { userId, day: dayCol, pinned: false } }),
    prisma.placeVisit.createMany({ data: rows }),
    prisma.placeSnapshot.upsert({
      where: { userId_day: { userId, day: dayCol } },
      create: { userId, day: dayCol },
      update: { takenAt: new Date() },
    }),
  ]);
  return rows.length;
}

/** After a correction: write that day again if it's finished; today waits. */
export async function resnapshotAt(userId: string, at: Date): Promise<void> {
  const iso = todayISO(at);
  if (iso >= todayISO()) return;
  try {
    await snapshotDay(userId, iso);
  } catch (e) {
    console.warn(`[visits] resnapshot failed: ${(e as Error).message}`);
  }
}

/** Unconfirmed spots with no visits left, and Google names past 30 days. */
async function tidy(): Promise<void> {
  const cutoff = new Date(Date.now() - KEEP_MS);
  await prisma.placeSpot.updateMany({
    where: { labelAt: { lt: cutoff } },
    data: { label: null, address: null, labelAt: null },
  });
  await prisma.placeSpot.deleteMany({ where: { visits: { none: {} }, createdAt: { lt: new Date(Date.now() - 60 * 60_000) } } });
}

/** Days that failed to write (v0.797): skipped until the server restarts, so
 *  one bad day can't hold up every day after it. The newest error shows on
 *  Admin → Family map. */
const failed = new Set<string>();
let lastError: { day: string; message: string; at: string } | null = null;
export const visitError = () => lastError;

/** The background timer's share: a few unwritten finished days per run. */
export async function snapshotTick(): Promise<void> {
  await tidy();
  const today = todayISO();
  const people = (await prisma.placesPerson.findMany({ select: { userId: true } })) as { userId: string }[];
  let budget = PER_TICK;
  for (const { userId } of people) {
    if (budget <= 0) break;
    const first = (await prisma.locationPoint.findFirst({
      where: { userId },
      orderBy: { at: "asc" },
      select: { at: true },
    })) as { at: Date } | null;
    if (!first) continue;
    const done = new Set(
      ((await prisma.placeSnapshot.findMany({ where: { userId }, select: { day: true } })) as { day: Date }[]).map((r) =>
        fromDateColumn(r.day),
      ),
    );
    for (let d = todayISO(first.at); d < today && budget > 0; d = addDays(d, 1)) {
      if (done.has(d) || failed.has(`${userId}:${d}`)) continue;
      budget--;
      try {
        await snapshotDay(userId, d);
      } catch (e) {
        failed.add(`${userId}:${d}`);
        lastError = { day: d, message: (e as Error).message.slice(0, 300), at: new Date().toISOString() };
        console.warn(`[visits] ${d} failed: ${lastError.message}`);
      }
    }
  }
}

/** A place was confirmed or changed: re-match the visits around it. */
export async function rematchAround(p: Pt, radiusM: number): Promise<void> {
  const b = boxAround(p, radiusM + SPOT_M);
  const visits = (await prisma.placeVisit.findMany({
    where: { pinned: false, zone: null, lat: { gte: b.minLat, lte: b.maxLat }, lng: { gte: b.minLng, lte: b.maxLng } },
    select: { id: true, userId: true, lat: true, lng: true, placeNameId: true, altPlaceNameId: true, spotId: true },
  })) as { id: string; userId: string; lat: number; lng: number; placeNameId: string | null; altPlaceNameId: string | null; spotId: string | null }[];
  for (const v of visits) {
    const p2 = { lat: v.lat, lng: v.lng };
    const got = pickPlace(await namesNear(p2, v.userId), p2);
    if (got.placeNameId === v.placeNameId && got.altPlaceNameId === v.altPlaceNameId && (got.placeNameId ? !v.spotId : true)) continue;
    await prisma.placeVisit.update({
      where: { id: v.id },
      data: got.placeNameId
        ? { placeNameId: got.placeNameId, altPlaceNameId: got.altPlaceNameId, spotId: null }
        : { placeNameId: null, altPlaceNameId: null, spotId: v.spotId ?? (await spotFor(p2, null)) },
    });
  }
  await prisma.placeSpot.deleteMany({ where: { visits: { none: {} } } });
}

// ---------- reading ----------

type VisitRow = {
  id: string;
  arrivedAt: Date;
  leftAt: Date;
  lat: number;
  lng: number;
  zone: string | null;
  user: { id: string; name: string; displayName: string | null; color: string; avatarPath: string | null; avatarPosition: string };
  placeName: { id: string; name: string | null; address: string | null } | null;
  altPlaceName: { id: string; name: string | null; address: string | null } | null;
  spot: { id: string; label: string | null; address: string | null; labelAt: Date | null } | null;
};

const VISIT_SELECT = {
  id: true,
  arrivedAt: true,
  leftAt: true,
  lat: true,
  lng: true,
  zone: true,
  user: { select: { id: true, name: true, displayName: true, color: true, avatarPath: true, avatarPosition: true } },
  placeName: { select: { id: true, name: true, address: true } },
  altPlaceName: { select: { id: true, name: true, address: true } },
  spot: { select: { id: true, label: true, address: true, labelAt: true } },
} as const;

function fresh(at: Date | null): boolean {
  return at == null || Date.now() - at.getTime() < KEEP_MS;
}

function toRow(v: VisitRow): PlaceVisitRow {
  const spotName = v.spot && fresh(v.spot.labelAt) ? v.spot.label : null;
  const spotAddr = v.spot && fresh(v.spot.labelAt) ? v.spot.address : null;
  return {
    id: v.id,
    arrivedAt: v.arrivedAt.toISOString(),
    leftAt: v.leftAt.toISOString(),
    lat: v.lat,
    lng: v.lng,
    person: {
      id: v.user.id,
      name: v.user.displayName || v.user.name,
      color: v.user.color,
      avatarPath: v.user.avatarPath,
      avatarPosition: v.user.avatarPosition,
    },
    place: v.zone ?? v.placeName?.name ?? spotName ?? null,
    address: v.zone ? null : shortAddress(v.placeName?.address ?? spotAddr ?? null),
    confirmed: Boolean(v.zone || v.placeName),
    placeKey: v.zone ? `zone:${v.zone}` : v.placeName ? `name:${v.placeName.id}` : v.spot ? `spot:${v.spot.id}` : null,
    choices: v.altPlaceName && v.placeName ? [{ id: v.placeName.id, name: v.placeName.name }, { id: v.altPlaceName.id, name: v.altPlaceName.name }] : null,
  };
}

/** Search visits by place name, the family's names, address or zone. */
export async function searchVisits(input: {
  q: string;
  userIds: string[];
  sinceISO: string | null;
  /** The last day to include (v0.812, a picked range). */
  untilISO?: string | null;
  placeKey?: string | null;
  offset: number;
}): Promise<VisitSearch> {
  const q = input.q.trim().slice(0, 80);
  const text = q
    ? {
        OR: [
          { zone: { contains: q, mode: "insensitive" as const } },
          { placeName: { is: { name: { contains: q, mode: "insensitive" as const } } } },
          { placeName: { is: { address: { contains: q, mode: "insensitive" as const } } } },
          { spot: { is: { label: { contains: q, mode: "insensitive" as const }, OR: [{ labelAt: null }, { labelAt: { gte: new Date(Date.now() - KEEP_MS) } }] } } },
          { spot: { is: { address: { contains: q, mode: "insensitive" as const }, OR: [{ labelAt: null }, { labelAt: { gte: new Date(Date.now() - KEEP_MS) } }] } } },
        ],
      }
    : {};
  const key = input.placeKey ?? null;
  const byPlace = key?.startsWith("zone:")
    ? { zone: key.slice(5) }
    : key?.startsWith("name:")
      ? { placeNameId: key.slice(5) }
      : key?.startsWith("spot:")
        ? { spotId: key.slice(5) }
        : {};
  const where = {
    ...text,
    ...byPlace,
    ...(input.userIds.length > 0 ? { userId: { in: input.userIds.slice(0, 20) } } : {}),
    ...(input.sinceISO || input.untilISO
      ? {
          day: {
            ...(input.sinceISO ? { gte: toDateColumn(input.sinceISO) } : {}),
            ...(input.untilISO ? { lte: toDateColumn(input.untilISO) } : {}),
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.placeVisit.findMany({ where, orderBy: { arrivedAt: "desc" }, skip: Math.max(0, input.offset), take: PAGE, select: VISIT_SELECT }) as Promise<VisitRow[]>,
    prisma.placeVisit.count({ where }),
  ]);
  return { visits: rows.map(toRow), total, more: input.offset + rows.length < total };
}

/** Every place with visits, for "All places". */
export async function listPlaces(
  opts: { viewerId?: string | null; everything?: boolean; fromISO?: string | null; toISO?: string | null } = {},
): Promise<{ rows: PlacesListRow[]; toConfirm: number; whichOne: number }> {
  // Dates (v0.812) count only visits in that stretch; a place with none drops.
  const dated = opts.fromISO || opts.toISO;
  const inDates = {
    ...(dated ? { day: { ...(opts.fromISO ? { gte: toDateColumn(opts.fromISO) } : {}), ...(opts.toISO ? { lte: toDateColumn(opts.toISO) } : {}) } } : {}),
  };
  // Someone who can't confirm everything sees only spots they stopped at.
  const mineOnly = opts.everything === false && opts.viewerId ? { userId: opts.viewerId } : {};
  const [byName, bySpot, byZone, names, spots, whichOne] = await Promise.all([
    prisma.placeVisit.groupBy({ by: ["placeNameId"], where: { placeNameId: { not: null }, ...inDates }, _count: { _all: true }, _max: { arrivedAt: true } }),
    prisma.placeVisit.groupBy({ by: ["spotId"], where: { spotId: { not: null }, ...inDates, ...mineOnly }, _count: { _all: true }, _max: { arrivedAt: true } }),
    prisma.placeVisit.groupBy({ by: ["zone"], where: { zone: { not: null }, ...inDates }, _count: { _all: true }, _max: { arrivedAt: true } }),
    prisma.placeName.findMany({ where: { name: { not: null } }, select: { id: true, name: true, address: true, kind: true, lat: true, lng: true, radiusM: true, userId: true } }),
    prisma.placeSpot.findMany({ select: { id: true, label: true, address: true, labelAt: true, lat: true, lng: true } }),
    prisma.placeVisit.count({ where: { altPlaceNameId: { not: null } } }),
  ]);
  // Who stopped at each spot (v0.813), for those who confirm everyone's.
  const whoAt = new Map<string, string[]>();
  if (opts.everything) {
    const pairs = (await prisma.placeVisit.findMany({ where: { spotId: { not: null }, ...inDates }, distinct: ["spotId", "userId"], select: { spotId: true, userId: true } })) as { spotId: string | null; userId: string }[];
    const users = (await prisma.user.findMany({
      where: { id: { in: [...new Set(pairs.map((p) => p.userId))] } },
      select: { id: true, name: true, displayName: true },
    })) as { id: string; name: string; displayName: string | null }[];
    const nameOf = new Map(users.map((u) => [u.id, u.displayName || u.name]));
    for (const p of pairs) {
      if (!p.spotId) continue;
      const n = nameOf.get(p.userId);
      if (n) whoAt.set(p.spotId, [...(whoAt.get(p.spotId) ?? []), n].sort());
    }
  }
  const nameStat = new Map(byName.map((g) => [g.placeNameId as string, g]));
  const spotStat = new Map(bySpot.map((g) => [g.spotId as string, g]));
  const rows: PlacesListRow[] = [];
  for (const n of names as { id: string; name: string | null; address: string | null; kind: string | null; lat: number; lng: number; radiusM: number; userId: string | null }[]) {
    const g = nameStat.get(n.id);
    if (dated && !g) continue;
    rows.push({
      key: `name:${n.id}`,
      name: n.name ?? "",
      address: shortAddress(n.address),
      confirmed: true,
      kind: typeLabel(n.kind),
      type: n.kind,
      visits: g?._count._all ?? 0,
      last: g?._max.arrivedAt?.toISOString() ?? null,
      lat: n.lat,
      lng: n.lng,
      radiusM: n.radiusM,
      justOne: n.userId != null,
    });
  }
  for (const s of spots as { id: string; label: string | null; address: string | null; labelAt: Date | null; lat: number; lng: number }[]) {
    const g = spotStat.get(s.id);
    if (!g) continue;
    if (!s.label || !fresh(s.labelAt)) {
      const got = await nameSpotLater(s);
      if (got) Object.assign(s, got);
    }
    const ok = fresh(s.labelAt);
    rows.push({
      key: `spot:${s.id}`,
      name: (ok ? s.label : null) ?? "",
      address: ok ? shortAddress(s.address) : null,
      confirmed: false,
      kind: "",
      type: null,
      visits: g._count._all,
      last: g._max.arrivedAt?.toISOString() ?? null,
      lat: s.lat,
      lng: s.lng,
      radiusM: SPOT_M,
      justOne: false,
      ...(whoAt.has(s.id) ? { who: whoAt.get(s.id) } : {}),
    });
  }
  for (const z of byZone) {
    rows.push({
      key: `zone:${z.zone}`,
      name: z.zone as string,
      address: null,
      confirmed: true,
      kind: "Zone",
      type: null,
      visits: z._count._all,
      last: z._max.arrivedAt?.toISOString() ?? null,
      lat: null,
      lng: null,
      radiusM: null,
      justOne: false,
    });
  }
  return { rows, toConfirm: rows.filter((r) => !r.confirmed).length, whichOne };
}

// ---------- changes ----------

/** "Which one?": the family picked the place for a visit. */
export async function chooseForVisit(visitId: string, placeNameId: string): Promise<{ error: string | null }> {
  const v = (await prisma.placeVisit.findUnique({
    where: { id: visitId },
    select: { placeNameId: true, altPlaceNameId: true },
  })) as { placeNameId: string | null; altPlaceNameId: string | null } | null;
  if (!v) return { error: "That visit is gone." };
  if (placeNameId !== v.placeNameId && placeNameId !== v.altPlaceNameId) return { error: "Pick one of the two." };
  await prisma.placeVisit.update({ where: { id: visitId }, data: { placeNameId, altPlaceNameId: null, spotId: null, pinned: true } });
  return { error: null };
}

/** Move one visit to a place the family chose (a confirmed place is found or
 *  made, small, so it doesn't swallow its neighbours). Only this visit moves. */
export async function moveVisit(
  visitId: string,
  c: { name: string; address: string | null; placeId: string | null; lat: number | null; lng: number | null },
): Promise<{ error: string | null }> {
  const v = (await prisma.placeVisit.findUnique({ where: { id: visitId }, select: { lat: true, lng: true } })) as { lat: number; lng: number } | null;
  if (!v) return { error: "That visit is gone." };
  const name = c.name.trim().slice(0, 80);
  if (!name) return { error: "Pick a place." };
  const at = { lat: c.lat ?? v.lat, lng: c.lng ?? v.lng };
  const b = boxAround(at, 300);
  const same = (await prisma.placeName.findFirst({
    where: c.placeId
      ? { googlePlaceId: c.placeId }
      : { name, lat: { gte: b.minLat, lte: b.maxLat }, lng: { gte: b.minLng, lte: b.maxLng } },
    select: { id: true },
  })) as { id: string } | null;
  const id =
    same?.id ??
    ((await prisma.placeName.create({
      data: { name, address: c.address?.slice(0, 200) ?? null, googlePlaceId: c.placeId?.slice(0, 300) ?? null, lat: at.lat, lng: at.lng, radiusM: SIZES.small },
      select: { id: true },
    })) as { id: string }).id;
  await prisma.placeVisit.update({ where: { id: visitId }, data: { placeNameId: id, altPlaceNameId: null, spotId: null, zone: null, pinned: true } });
  return { error: null };
}

/** "That's right": confirm an unconfirmed spot as Google named it. */
/** How far the map may move a place's centre from where it was (v0.812.1). */
const MOVE_M = 400;
function movedTo(from: Pt, to: { lat?: number | null; lng?: number | null } | null | undefined): Pt {
  if (!to || to.lat == null || to.lng == null || !Number.isFinite(to.lat) || !Number.isFinite(to.lng)) return from;
  const p = { lat: to.lat, lng: to.lng };
  const d = metres(from, p);
  return d >= 2 && d <= MOVE_M ? p : from;
}

export async function confirmSpot(
  spotId: string,
  kind: string | null,
  size: keyof typeof SIZES,
  at?: { lat?: number | null; lng?: number | null } | null,
): Promise<{ error: string | null }> {
  const s = (await prisma.placeSpot.findUnique({
    where: { id: spotId },
    select: { lat: true, lng: true, label: true, address: true, googlePlaceId: true, labelAt: true },
  })) as { lat: number; lng: number; label: string | null; address: string | null; googlePlaceId: string | null; labelAt: Date | null } | null;
  if (!s) return { error: "That place is gone." };
  if (!s.label || !fresh(s.labelAt)) return { error: "No name to confirm. Pick or type one." };
  const radiusM = radiusFor(kind, size) ?? SIZES.normal;
  const c = movedTo(s, at);
  await prisma.placeName.create({
    data: { name: s.label, address: s.address, googlePlaceId: s.googlePlaceId, lat: c.lat, lng: c.lng, radiusM, kind: cleanKind(kind) },
  });
  await rematchAround(c, radiusM + metres(s, c));
  return { error: null };
}

/** Rename a confirmed place, or change whether it's a home and its size. */
export async function updatePlace(
  placeNameId: string,
  input: { name?: string; kind?: string | null; size?: keyof typeof SIZES; lat?: number | null; lng?: number | null },
): Promise<{ error: string | null }> {
  const p = (await prisma.placeName.findUnique({ where: { id: placeNameId }, select: { lat: true, lng: true, radiusM: true } })) as {
    lat: number;
    lng: number;
    radiusM: number;
  } | null;
  if (!p) return { error: "That place is gone." };
  const name = input.name?.trim().slice(0, 80);
  if (input.name !== undefined && !name) return { error: "Type a name." };
  const radiusM = (input.kind !== undefined ? typeRadiusM(input.kind) : null) ?? (input.size ? SIZES[input.size] : undefined);
  const c = movedTo(p, input);
  const moved = metres(p, c);
  await prisma.placeName.update({
    where: { id: placeNameId },
    data: {
      ...(name ? { name } : {}),
      ...(input.kind !== undefined ? { kind: cleanKind(input.kind) } : {}),
      ...(radiusM ? { radiusM } : {}),
      ...(moved > 0 ? { lat: c.lat, lng: c.lng } : {}),
    },
  });
  if ((radiusM && radiusM !== p.radiusM) || moved > 0) await rematchAround(p, Math.max(radiusM ?? p.radiusM, p.radiusM) + moved);
  return { error: null };
}

/** A place's type (v0.812: the PLACE_TYPES keys; "business" from before). */
export function cleanKind(k: unknown): string | null {
  return typeof k === "string" && (k === "business" || placeType(k)) ? k : null;
}

/** The size for a place: its type's reach, else the old size names. */
export function radiusFor(kind: string | null | undefined, size: keyof typeof SIZES | null | undefined): number | null {
  return typeRadiusM(kind) ?? (size ? SIZES[size] : null);
}

/**
 * Who may confirm a spot (v0.812): parents, anyone an admin let confirm
 * everyone's places, or someone who stopped there.
 */
export const CONFIRM_ALL = "places.confirmAll";
export async function confirmAllIds(): Promise<string[]> {
  const raw = await getSetting(CONFIRM_ALL);
  return (raw ?? "").split(",").filter(Boolean);
}
export async function canConfirmEverything(userId: string | null, isParent: boolean): Promise<boolean> {
  if (isParent) return true;
  return !!userId && (await confirmAllIds()).includes(userId);
}
export async function stoppedAt(userId: string, spotId: string): Promise<boolean> {
  return (await prisma.placeVisit.count({ where: { userId, spotId } })) > 0;
}

/** Sizes of the visit tables, for Admin → Family map → Status. */
export async function visitStorage(): Promise<{ visits: number; places: number; bytes: number; error: { day: string; message: string } | null }> {
  const [visits, places, size] = await Promise.all([
    prisma.placeVisit.count(),
    prisma.placeSpot.count(),
    prisma.$queryRaw`SELECT (pg_total_relation_size('"PlaceVisit"') + pg_total_relation_size('"PlaceSpot"') + pg_total_relation_size('"PlaceSnapshot"'))::bigint AS bytes` as Promise<
      { bytes: bigint }[]
    >,
  ]);
  const named = await prisma.placeName.count();
  return { visits, places: places + named, bytes: Number(size[0]?.bytes ?? 0), error: lastError ? { day: lastError.day, message: lastError.message } : null };
}
