"use server";

import { todaysTracks, trackedIds } from "@/lib/places/tracks";
import { loadLive } from "@/lib/places/live";
import { loadDay } from "@/lib/places/history";
import { nearbyChoices, saveFamilyName, searchChoices, type PlaceChoice } from "@/lib/places/naming";
import { addStop, canEditHistory, removeStop, undoStopEdit } from "@/lib/places/stop-edits";
import { currentUser } from "@/lib/user-session";
import { takeMapLoad } from "@/lib/places/usage";
import type { LiveData } from "@/lib/places/live-types";
import type { DayData } from "@/lib/places/history-types";

/**
 * The Places page's server actions. Behind the web sign-in (proxy.ts) like
 * every server action; everyone in the house sees everyone (owner's choice).
 */
export async function refreshPlacesLive(): Promise<LiveData> {
  return loadLive();
}

/** Counted once per map the browser opens — Google bills per map load.
 *  False when today's map loads are used up (v0.778). */
export async function notePlacesMapLoad(): Promise<boolean> {
  return takeMapLoad();
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
  radiusM?: number,
): Promise<{ choices: PlaceChoice[]; error: string | null }> {
  return searchChoices(lat, lng, query, radiusM);
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
  kind?: string | null;
  size?: "small" | "normal" | "large" | null;
}): Promise<{ error: string | null }> {
  return saveFamilyName(input);
}

/** Day corrections from the web (v0.769): only parents sign in there, but
 *  check anyway (first-run open mode has no one signed in). */
async function editor(): Promise<string | null | false> {
  const me = await currentUser();
  if (!me) return null; // first run, before anyone has a password
  return (await canEditHistory(me.id)) ? me.id : false;
}

export async function removeStopAction(personId: string, startISO: string): Promise<{ error: string | null }> {
  const by = await editor();
  if (by === false) return { error: "Only parents can change history." };
  return removeStop(personId, startISO, by);
}

export async function undoStopEditAction(editId: string): Promise<{ error: string | null }> {
  if ((await editor()) === false) return { error: "Only parents can change history." };
  return undoStopEdit(editId);
}

export async function addStopAction(input: {
  personId: string;
  fromISO: string;
  toISO: string;
  lat: number;
  lng: number;
  name: string | null;
  address: string | null;
}): Promise<{ error: string | null }> {
  const by = await editor();
  if (by === false) return { error: "Only parents can change history." };
  return addStop({ ...input, byId: by });
}
