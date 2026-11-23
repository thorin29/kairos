import "server-only";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";

/**
 * Counts of the Google calls Kairos makes, per household day, so Admin can
 * show usage and Kairos can stop itself before Google's free monthly
 * allowance. Map loads are counted when a browser opens the map.
 */
import type { ApiKind, UsageSummary } from "@/lib/places/usage-types";
export type { ApiKind, UsageSummary };

/** Kairos's own daily ceilings, under the daily caps set in Google's console
 *  (Places 150, Geocoding 300, Roads 150, Routes 300) and inside the free monthly allowance. */
export const DAILY_LIMIT: Record<Exclude<ApiKind, "mapload">, number> = {
  nearby: 140,
  geocode: 280,
  roads: 140,
  routes: 280,
  search: 40,
};

/** Google's free calls per month for each SKU Kairos uses (since March 2025:
 *  Essentials 10,000; Pro 5,000 — Nearby Search and Roads are Pro; Routes with ≤10 stops is Essentials). */
export const FREE_PER_MONTH: Record<ApiKind, number> = {
  mapload: 10_000,
  geocode: 10_000,
  nearby: 5_000,
  roads: 5_000,
  routes: 10_000,
  search: 5_000,
};

export async function bump(kind: ApiKind): Promise<void> {
  const day = todayISO();
  await prisma.placesApiUsage.upsert({
    where: { day_kind: { day, kind } },
    create: { day, kind, count: 1 },
    update: { count: { increment: 1 } },
  });
}

export async function usedToday(kind: ApiKind): Promise<number> {
  const row = (await prisma.placesApiUsage.findUnique({
    where: { day_kind: { day: todayISO(), kind } },
    select: { count: true },
  })) as { count: number } | null;
  return row?.count ?? 0;
}

/** True when another call of this kind fits today's ceiling. */
export async function canCall(kind: Exclude<ApiKind, "mapload">): Promise<boolean> {
  return (await usedToday(kind)) < DAILY_LIMIT[kind];
}

export async function usageSummary(): Promise<UsageSummary> {
  const today = todayISO();
  const month = today.slice(0, 7);
  const rows = (await prisma.placesApiUsage.findMany({
    where: { day: { startsWith: month } },
    select: { day: true, kind: true, count: true },
  })) as { day: string; kind: string; count: number }[];
  const kinds: ApiKind[] = ["mapload", "geocode", "nearby", "search", "roads", "routes"];
  const out = {} as UsageSummary;
  for (const k of kinds) {
    const mine = rows.filter((r) => r.kind === k);
    out[k] = {
      today: mine.filter((r) => r.day === today).reduce((s, r) => s + r.count, 0),
      month: mine.reduce((s, r) => s + r.count, 0),
      free: FREE_PER_MONTH[k],
      limit: k === "mapload" ? null : DAILY_LIMIT[k],
    };
  }
  return out;
}
