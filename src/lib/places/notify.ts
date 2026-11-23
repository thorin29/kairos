import "server-only";
import { prisma } from "@/lib/prisma";
import { householdTz } from "@/lib/dates";
import { metres } from "@/lib/places/geo";
import { fenceStep } from "@/lib/places/fence";
import { notify } from "@/lib/push";

/**
 * Places notifications (v0.759): after a new position arrives, check it
 * against the places that rules mention (named places and saved addresses —
 * Kairos's own, not Home Assistant zones) and queue "<name> arrived at
 * <place>" / "left" for the people each rule tells. Only places some rule
 * uses are tracked, so with no rules this costs one query.
 */

const SAVED_RADIUS_M = 120;
/** No second notification for the same person and place within this long. */
const COOLDOWN_MS = 10 * 60_000;
/** Don't announce old points (a delayed batch). */
const FRESH_MS = 30 * 60_000;

type Rule = {
  id: string;
  tellUserIds: unknown;
  aboutUserId: string | null;
  onArrive: boolean;
  onLeave: boolean;
  placeName: { id: string; name: string | null; lat: number; lng: number; radiusM: number; userId: string | null } | null;
  savedAddress: { id: string; name: string; lat: number | null; lng: number | null } | null;
};

type Place = { key: string; name: string; lat: number; lng: number; radiusM: number };

function placeOf(r: Rule, userId: string): Place | null {
  if (r.placeName) {
    const p = r.placeName;
    if (p.userId && p.userId !== userId) return null; // someone else's own place
    return { key: `n:${p.id}`, name: p.name ?? "a saved spot", lat: p.lat, lng: p.lng, radiusM: p.radiusM };
  }
  if (r.savedAddress && r.savedAddress.lat != null && r.savedAddress.lng != null) {
    const s = r.savedAddress;
    return { key: `s:${s.id}`, name: s.name, lat: s.lat!, lng: s.lng!, radiusM: SAVED_RADIUS_M };
  }
  return null;
}

export async function checkPlaces(
  userId: string,
  point: { lat: number; lng: number; accuracyM: number | null; at: Date },
): Promise<void> {
  if (Date.now() - point.at.getTime() > FRESH_MS) return;
  const rules = (await prisma.placesNotifyRule.findMany({
    where: { OR: [{ aboutUserId: null }, { aboutUserId: userId }] },
    select: {
      id: true,
      tellUserIds: true,
      aboutUserId: true,
      onArrive: true,
      onLeave: true,
      placeName: { select: { id: true, name: true, lat: true, lng: true, radiusM: true, userId: true } },
      savedAddress: { select: { id: true, name: true, lat: true, lng: true } },
    },
  })) as Rule[];
  if (rules.length === 0) return;

  const places = new Map<string, { place: Place; rules: Rule[] }>();
  for (const r of rules) {
    const p = placeOf(r, userId);
    if (!p) continue;
    const e = places.get(p.key) ?? { place: p, rules: [] };
    e.rules.push(r);
    places.set(p.key, e);
  }
  if (places.size === 0) return;

  const states = (await prisma.placesAlertState.findMany({
    where: { userId, placeKey: { in: [...places.keys()] } },
    select: { placeKey: true, inside: true, notifiedAt: true },
  })) as { placeKey: string; inside: boolean; notifiedAt: Date | null }[];
  const stateOf = new Map(states.map((s) => [s.placeKey, s]));

  let who: string | null = null;
  const now = Date.now();
  for (const { place, rules: placeRules } of places.values()) {
    const prev = stateOf.get(place.key) ?? null;
    const step = fenceStep(prev, metres(point, place), place.radiusM, point.accuracyM);
    if (!step) continue;
    if (!prev || prev.inside !== step.inside) {
      await prisma.placesAlertState.upsert({
        where: { userId_placeKey: { userId, placeKey: place.key } },
        create: { userId, placeKey: place.key, inside: step.inside },
        update: { inside: step.inside, changedAt: new Date(now) },
      });
    }
    if (!step.changed) continue;
    if (prev?.notifiedAt && now - prev.notifiedAt.getTime() < COOLDOWN_MS) continue;

    const tell = new Set<string>();
    for (const r of placeRules) {
      if (step.inside ? !r.onArrive : !r.onLeave) continue;
      const ids = Array.isArray(r.tellUserIds) ? (r.tellUserIds as unknown[]) : [];
      for (const id of ids) if (typeof id === "string" && id !== userId) tell.add(id);
    }
    if (tell.size === 0) continue;

    if (who == null) {
      const u = (await prisma.user.findUnique({ where: { id: userId }, select: { name: true, displayName: true } })) as {
        name: string;
        displayName: string | null;
      } | null;
      who = u ? u.displayName || u.name : "Someone";
    }
    const time = new Intl.DateTimeFormat("en-US", { timeZone: householdTz(), hour: "numeric", minute: "2-digit" }).format(point.at);
    await notify([...tell], {
      kind: "places",
      title: `${who} ${step.inside ? "arrived at" : "left"} ${place.name}`,
      body: time,
      link: "/places",
    });
    await prisma.placesAlertState.update({
      where: { userId_placeKey: { userId, placeKey: place.key } },
      data: { notifiedAt: new Date(now) },
    });
  }
}
