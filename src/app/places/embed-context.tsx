"use client";

import { createContext, useContext } from "react";
import { namePlace, notePlacesMapLoad, placeChoices, placesTracks, refreshPlacesLive, searchPlaceChoices } from "@/lib/actions/places-live";
import type { PlaceChoice } from "@/lib/places/naming-types";
import type { LiveData } from "@/lib/places/live-types";
import type { DayData } from "@/lib/places/history-types";

/**
 * Places inside the phone app (v0.762): the same pages under /places/embed,
 * reading through /api/v1/places/view/* (the app's Places cookie) instead of
 * server actions, which that cookie doesn't open.
 */
const Embed = createContext(false);

export function EmbedProvider({ children }: { children: React.ReactNode }) {
  return <Embed.Provider value>{children}</Embed.Provider>;
}

export function useEmbed(): boolean {
  return useContext(Embed);
}

/** Where Places (or a person's day) lives for this view. */
export function placesHref(embed: boolean, personId?: string, date?: string): string {
  const base = embed ? "/places/embed" : "/places";
  if (!personId) return base;
  return `${base}/${personId}${date ? `?date=${date}` : ""}`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store", headers: { "x-kairos-embed": "1" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function liveNow(embed: boolean): Promise<LiveData> {
  if (!embed) return refreshPlacesLive();
  const data = await getJson<LiveData & { state: string }>("/api/v1/places/view/live");
  if (data.state !== "ok") throw new Error("Places is off");
  return data;
}

export async function tracksNow(embed: boolean, ids: string[]): Promise<Record<string, DayData>> {
  if (!embed) return placesTracks(ids);
  const data = await getJson<{ tracks: Record<string, DayData> }>(
    `/api/v1/places/view/tracks?ids=${encodeURIComponent(ids.join(","))}`,
  );
  return data.tracks;
}

export async function mapLoaded(embed: boolean): Promise<void> {
  if (!embed) return notePlacesMapLoad();
  await fetch("/api/v1/places/view/mapload", { method: "POST", credentials: "same-origin" });
}

type Spot = { lat: number; lng: number; accuracyM: number | null };

export async function choicesNow(embed: boolean, spot: Spot): Promise<PlaceChoice[]> {
  if (!embed) return placeChoices(spot.lat, spot.lng, spot.accuracyM);
  const acc = spot.accuracyM != null ? `&acc=${spot.accuracyM}` : "";
  return (await getJson<{ choices: PlaceChoice[] }>(`/api/v1/places/view/choices?lat=${spot.lat}&lng=${spot.lng}${acc}`)).choices;
}

export async function searchNow(embed: boolean, spot: Spot, q: string): Promise<{ choices: PlaceChoice[]; error: string | null }> {
  if (!embed) return searchPlaceChoices(spot.lat, spot.lng, q);
  return getJson(`/api/v1/places/view/search?lat=${spot.lat}&lng=${spot.lng}&q=${encodeURIComponent(q)}`);
}

export async function saveNameNow(
  embed: boolean,
  input: Parameters<typeof namePlace>[0],
): Promise<{ error: string | null }> {
  if (!embed) return namePlace(input);
  const res = await fetch("/api/v1/places/view/name", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-kairos-embed": "1" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return { error: "Couldn't save. Try again." };
  return (await res.json()) as { error: string | null };
}
