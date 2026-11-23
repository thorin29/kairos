import "server-only";
import { prisma } from "@/lib/prisma";
import { householdTz } from "@/lib/dates";
import {
  emptyPrefs,
  sanitizePrefs,
  type NotifyPrefsData,
  type PlaceRule,
} from "@/lib/notify-prefs-shape";

export type { NotifyPrefsData, PlaceRule };

/**
 * Each person's notification choices (v0.772), set on their own phone and
 * kept here so a new phone starts with them. Until someone's phone saves
 * them, Family map rules an admin made that tell that person are their
 * starting choices, and calendar/task alerts start off (the phone sends its
 * own current switches the first time, so nobody gains or loses alerts).
 */

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; prefs: NotifyPrefsData; saved: boolean }>();

type OldRule = {
  id: string;
  tellUserIds: unknown;
  aboutUserId: string | null;
  onArrive: boolean;
  onLeave: boolean;
  zone: string | null;
  placeNameId: string | null;
  savedAddressId: string | null;
};

/** Admin rules (before v0.772) that told this person, as their own choices. */
async function fromAdminRules(userId: string): Promise<PlaceRule[]> {
  const rows = (await prisma.placesNotifyRule.findMany({
    select: { id: true, tellUserIds: true, aboutUserId: true, onArrive: true, onLeave: true, zone: true, placeNameId: true, savedAddressId: true },
  })) as OldRule[];
  const out: PlaceRule[] = [];
  for (const r of rows) {
    const tell = Array.isArray(r.tellUserIds) ? (r.tellUserIds as unknown[]) : [];
    if (!tell.includes(userId)) continue;
    const place = r.zone ? `z:${r.zone}` : r.placeNameId ? `n:${r.placeNameId}` : r.savedAddressId ? `s:${r.savedAddressId}` : null;
    if (!place) continue;
    out.push({ id: r.id, about: r.aboutUserId, place, arrive: r.onArrive, leave: r.onLeave });
  }
  return out;
}

/** This person's choices, and whether their phone has saved them yet. */
export async function loadPrefs(userId: string): Promise<{ prefs: NotifyPrefsData; saved: boolean }> {
  const hit = cache.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_MS) return { prefs: hit.prefs, saved: hit.saved };
  const row = (await prisma.notifyPrefs.findUnique({ where: { userId }, select: { prefs: true } })) as { prefs: unknown } | null;
  const result = row
    ? { prefs: sanitizePrefs(row.prefs), saved: true }
    : { prefs: { ...emptyPrefs(), places: await fromAdminRules(userId) }, saved: false };
  cache.set(userId, { at: now, ...result });
  return result;
}

export async function savePrefs(userId: string, raw: unknown): Promise<NotifyPrefsData> {
  const prefs = sanitizePrefs(raw);
  await prisma.notifyPrefs.upsert({
    where: { userId },
    create: { userId, prefs },
    update: { prefs },
  });
  cache.set(userId, { at: Date.now(), prefs, saved: true });
  return prefs;
}

/** Everyone active, with their choices (small household: one pass). */
export async function everyonesPrefs(): Promise<{ userId: string; prefs: NotifyPrefsData }[]> {
  const users = (await prisma.user.findMany({ where: { isActive: true }, select: { id: true } })) as { id: string }[];
  const out: { userId: string; prefs: NotifyPrefsData }[] = [];
  for (const u of users) out.push({ userId: u.id, prefs: (await loadPrefs(u.id)).prefs });
  return out;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** When a held notification may go out: the end of quiet hours, or null (now). */
export function quietUntil(prefs: NotifyPrefsData, now = new Date()): Date | null {
  const q = prefs.quiet;
  if (!q) return null;
  const tz = householdTz();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const cur = h * 60 + m;
  const from = minutesOf(q.from);
  const to = minutesOf(q.to);
  const inQuiet = from <= to ? cur >= from && cur < to : cur >= from || cur < to;
  if (!inQuiet) return null;
  const wait = (to - cur + 24 * 60) % (24 * 60);
  return new Date(now.getTime() + wait * 60_000 - now.getSeconds() * 1000);
}
