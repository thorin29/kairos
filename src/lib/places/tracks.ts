import "server-only";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { loadDay } from "@/lib/places/history";
import type { DayData } from "@/lib/places/history-types";

/** Which of these ids are tracked people (at most 20 asked about). */
export async function trackedIds(ids: string[]): Promise<string[]> {
  const rows = (await prisma.placesPerson.findMany({
    where: { userId: { in: ids.slice(0, 20) } },
    select: { userId: true },
  })) as { userId: string }[];
  return rows.map((r) => r.userId);
}

/** Today's tracks for the people whose tracks are switched on (no names). */
export async function todaysTracks(ids: string[]): Promise<Record<string, DayData>> {
  const today = todayISO();
  const out: Record<string, DayData> = {};
  for (const id of await trackedIds(ids)) out[id] = await loadDay(id, today, { names: false });
  return out;
}
