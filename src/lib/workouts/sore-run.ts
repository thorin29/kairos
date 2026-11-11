import "server-only";
import { getSetting, setSetting } from "@/lib/settings";
import { parseSore, withSore, withoutSore, type SoreArea, type SoreSpot } from "@/lib/workouts/sore";

/** Sore spots (v0.675), kept per person in a setting. */
const key = (userId: string) => `workouts.sore.${userId}`;

export async function soreSpotsFor(userId: string): Promise<SoreSpot[]> {
  return parseSore(await getSetting(key(userId)));
}

export async function markSore(userId: string, area: SoreArea, dateISO: string, from: string | null = null): Promise<SoreSpot[]> {
  const list = withSore(await soreSpotsFor(userId), { area, since: dateISO, from });
  await setSetting(key(userId), JSON.stringify(list));
  return list;
}

/** Better: the area is no longer marked. */
export async function clearSore(userId: string, area: SoreArea): Promise<SoreSpot[]> {
  const list = withoutSore(await soreSpotsFor(userId), area);
  await setSetting(key(userId), JSON.stringify(list));
  return list;
}
