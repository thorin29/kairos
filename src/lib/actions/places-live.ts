"use server";

import { prisma } from "@/lib/prisma";
import { todaysTracks, trackedIds } from "@/lib/places/tracks";
import { loadLive, bustPlaceMemo } from "@/lib/places/live";
import { loadDay } from "@/lib/places/history";
import { candidatesNear, type Candidate } from "@/lib/places/resolve";
import { bump } from "@/lib/places/usage";
import type { LiveData } from "@/lib/places/live-types";
import type { DayData } from "@/lib/places/history-types";

/**
 * The Places page's server actions. Behind the web sign-in (proxy.ts) like
 * every server action; everyone in the house sees everyone (owner's choice).
 */
export async function refreshPlacesLive(): Promise<LiveData> {
  return loadLive();
}

/** Counted once per map the browser opens — Google bills per map load. */
export async function notePlacesMapLoad(): Promise<void> {
  await bump("mapload");
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Today's tracks for the people whose tracks are switched on (no names). */
export async function placesTracks(ids: string[]): Promise<Record<string, DayData>> {
  return todaysTracks(ids);
}

/** A person's whole day, named, for the History page. */
export async function placesDay(userId: string, date: string): Promise<DayData | null> {
  if (!ISO.test(date) || (await trackedIds([userId])).length === 0) return null;
  return loadDay(userId, date, { names: true });
}

/** Other businesses near a spot, for "Not right?". */
export async function placeChoices(lat: number, lng: number, accuracyM: number | null): Promise<Candidate[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  return candidatesNear({ lat, lng, accuracyM });
}

/**
 * Name a spot. `name` null = "just the street address here". `forUserId`
 * set = only that person's stops get this name (their own "Work").
 */
export async function namePlace(input: {
  lat: number;
  lng: number;
  name: string | null;
  forUserId: string | null;
}): Promise<{ error: string | null }> {
  const name = input.name?.trim().slice(0, 80) || null;
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng) || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) {
    return { error: "That spot has no usable position." };
  }
  if (input.forUserId && (await trackedIds([input.forUserId])).length === 0) {
    return { error: "That person isn't tracked." };
  }
  await prisma.placeName.create({
    data: { lat: input.lat, lng: input.lng, name, userId: input.forUserId, radiusM: 100 },
  });
  bustPlaceMemo();
  return { error: null };
}
