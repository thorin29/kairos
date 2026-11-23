"use server";

import { todaysTracks, trackedIds } from "@/lib/places/tracks";
import { loadLive } from "@/lib/places/live";
import { loadDay } from "@/lib/places/history";
import { nearbyChoices, saveFamilyName, searchChoices, type PlaceChoice } from "@/lib/places/naming";
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

/** Businesses near a spot, for "Not right?". */
export async function placeChoices(lat: number, lng: number, accuracyM: number | null): Promise<PlaceChoice[]> {
  return nearbyChoices(lat, lng, accuracyM);
}

/** Look up what was typed for "Not right?", near the spot. */
export async function searchPlaceChoices(
  lat: number,
  lng: number,
  query: string,
): Promise<{ choices: PlaceChoice[]; error: string | null }> {
  return searchChoices(lat, lng, query);
}

/** Save the family's name for a spot (everyone, or `forUserId` only). */
export async function namePlace(input: {
  lat: number;
  lng: number;
  name: string;
  address: string | null;
  placeId: string | null;
  placeLat: number | null;
  placeLng: number | null;
  forUserId: string | null;
}): Promise<{ error: string | null }> {
  return saveFamilyName(input);
}
