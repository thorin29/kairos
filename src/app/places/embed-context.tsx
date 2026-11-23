"use client";

import { createContext, useContext } from "react";
import {
  addStopAction,
  namePlace,
  notePlacesMapLoad,
  placeChoices,
  placesTracks,
  refreshPlacesLive,
  removeStopAction,
  searchPlaceChoices,
  undoStopEditAction,
} from "@/lib/actions/places-live";
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

export async function searchNow(
  embed: boolean,
  spot: Spot,
  q: string,
  radiusM?: number,
): Promise<{ choices: PlaceChoice[]; error: string | null }> {
  if (!embed) return searchPlaceChoices(spot.lat, spot.lng, q, radiusM);
  const r = radiusM ? `&r=${Math.round(radiusM)}` : "";
  return getJson(`/api/v1/places/view/search?lat=${spot.lat}&lng=${spot.lng}&q=${encodeURIComponent(q)}${r}`);
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

export type StopChange =
  | { op: "remove"; personId: string; start: string }
  | { op: "undo"; editId: string }
  | { op: "add"; personId: string; from: string; to: string; lat: number; lng: number; name: string | null; address: string | null };

/** A correction to a day (parents only; the server checks). */
export async function changeStopNow(embed: boolean, c: StopChange): Promise<{ error: string | null }> {
  if (!embed) {
    if (c.op === "remove") return removeStopAction(c.personId, c.start);
    if (c.op === "undo") return undoStopEditAction(c.editId);
    return addStopAction({ personId: c.personId, fromISO: c.from, toISO: c.to, lat: c.lat, lng: c.lng, name: c.name, address: c.address });
  }
  const res = await fetch("/api/v1/places/view/stops", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-kairos-embed": "1" },
    body: JSON.stringify(c),
  });
  if (!res.ok) return { error: res.status === 403 ? "Only parents can change history." : "Couldn't save. Try again." };
  return (await res.json()) as { error: string | null };
}
