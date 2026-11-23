import "server-only";
import { prisma } from "@/lib/prisma";
import { householdTz } from "@/lib/dates";
import { metres } from "@/lib/places/geo";
import { fenceStep } from "@/lib/places/fence";
import { notify } from "@/lib/push";
import { everyonesPrefs } from "@/lib/notify-prefs";

/**
 * Family map notifications: after a new position arrives, check it against
 * the places people asked about (v0.772: each person's own choices, set on
 * their phone) — named places and saved addresses by distance, Home
 * Assistant zones by HA's own zone changes — and tell each person who asked
 * "<name> arrived at <place>" / "left". Nobody is told about themselves.
 * Only places someone asked about are tracked.
 */

const SAVED_RADIUS_M = 120;
/** No second notification for the same person and place within this long. */
const COOLDOWN_MS = 10 * 60_000;
/** Don't announce old points (a delayed batch). */
const FRESH_MS = 30 * 60_000;

type Place = { key: string; name: string; lat: number; lng: number; radiusM: number; zone?: string };
type Want = { tell: string; arrive: boolean; leave: boolean };

async function placeFor(key: string, userId: string): Promise<Place | null> {
  if (key.startsWith("z:")) {
    const zone = key.slice(2);
    return { key, name: zone, lat: 0, lng: 0, radiusM: 0, zone };
  }
  if (key.startsWith("n:")) {
    const p = (await prisma.placeName.findUnique({
      where: { id: key.slice(2) },
      select: { name: true, lat: true, lng: true, radiusM: true, userId: true },
    })) as { name: string | null; lat: number; lng: number; radiusM: number; userId: string | null } | null;
    if (!p || (p.userId && p.userId !== userId)) return null; // gone, or someone else's own place
    return { key, name: p.name ?? "a saved spot", lat: p.lat, lng: p.lng, radiusM: p.radiusM };
  }
  if (key.startsWith("s:")) {
    const addr = (await prisma.savedAddress.findUnique({
      where: { id: key.slice(2) },
      select: { name: true, lat: true, lng: true },
    })) as { name: string; lat: number | null; lng: number | null } | null;
    if (!addr || addr.lat == null || addr.lng == null) return null;
    return { key, name: addr.name, lat: addr.lat, lng: addr.lng, radiusM: SAVED_RADIUS_M };
  }
  return null;
}

export async function checkPlaces(
  userId: string,
  point: { lat: number; lng: number; accuracyM: number | null; at: Date; zone: string | null },
): Promise<void> {
  if (Date.now() - point.at.getTime() > FRESH_MS) return;
  const wanted = new Map<string, Want[]>();
  for (const { userId: tell, prefs } of await everyonesPrefs()) {
    if (tell === userId) continue;
    for (const r of prefs.places) {
      if (r.about != null && r.about !== userId) continue;
      const list = wanted.get(r.place) ?? [];
      list.push({ tell, arrive: r.arrive, leave: r.leave });
      wanted.set(r.place, list);
    }
  }
  if (wanted.size === 0) return;

  const places = new Map<string, { place: Place; wants: Want[] }>();
  for (const [key, wants] of wanted) {
    const p = await placeFor(key, userId);
    if (p) places.set(key, { place: p, wants });
  }
  if (places.size === 0) return;

  const states = (await prisma.placesAlertState.findMany({
    where: { userId, placeKey: { in: [...places.keys()] } },
    select: { placeKey: true, inside: true, notifiedAt: true },
  })) as { placeKey: string; inside: boolean; notifiedAt: Date | null }[];
  const stateOf = new Map(states.map((s) => [s.placeKey, s]));

  let who: string | null = null;
  const now = Date.now();
  for (const { place, wants } of places.values()) {
    const prev = stateOf.get(place.key) ?? null;
    // Zones follow Home Assistant's own decision; places use distance.
    const step = place.zone
      ? prev
        ? { inside: point.zone === place.zone, changed: prev.inside !== (point.zone === place.zone) }
        : { inside: point.zone === place.zone, changed: false }
      : fenceStep(prev, metres(point, place), place.radiusM, point.accuracyM);
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
    for (const w of wants) if (step.inside ? w.arrive : w.leave) tell.add(w.tell);
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
    }, { quiet: true });
    await prisma.placesAlertState.update({
      where: { userId_placeKey: { userId, placeKey: place.key } },
      data: { notifiedAt: new Date(now) },
    });
  }
}
