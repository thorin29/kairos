"use client";

import { createContext, useContext, useEffect, type RefObject } from "react";
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
import type { PlacesList, VisitSearch } from "@/lib/places/visits-types";

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

/** Count a map about to open; false when today's map loads are used up.
 *  A failed count lets the map open. */
export async function mapLoaded(embed: boolean): Promise<boolean> {
  try {
    if (!embed) return await notePlacesMapLoad();
    const res = await fetch("/api/v1/places/view/mapload", { method: "POST", credentials: "same-origin" });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return body.ok !== false;
  } catch {
    return true;
  }
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

type Bridge = { mapBottom?: (px: number) => void; mapBand?: (top: number, bottom: number) => void };
const bridge = (): Bridge | undefined => (window as unknown as { KairosPlaces?: Bridge }).KairosPlaces;

/** Tell the app which band of the screen is a map (top and bottom, CSS px); 0,0 = none. */
function sendBand(top: number, bottom: number): void {
  const b = bridge();
  if (b?.mapBand) b.mapBand(top, bottom);
  else b?.mapBottom?.(bottom);
}

/**
 * In the phone app (v0.793; any band v0.812.2): tell the app where a map is on
 * screen, so a sideways swipe anywhere else opens the app's menu while swipes
 * on the map still pan it. Pass the map's element; when it goes away the band
 * is cleared. The app adds the `KairosPlaces` bridge; on the web it isn't
 * there and this does nothing.
 */
export function useMapEdge(embed: boolean, map: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!embed) return;
    const el = map.current;
    if (!bridge() || !el) return;
    maps.push(el);
    const send = () => sendTop();
    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    window.addEventListener("resize", send);
    // A map inside a sheet moves when the sheet scrolls.
    window.addEventListener("scroll", send, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", send);
      window.removeEventListener("scroll", send, true);
      const i = maps.lastIndexOf(el);
      if (i >= 0) maps.splice(i, 1);
      sendTop();
    };
  }, [embed, map]);
}

/** Maps on screen, newest (topmost) last: a picker over the day's map wins. */
const maps: HTMLElement[] = [];
function sendTop(): void {
  const el = maps[maps.length - 1];
  if (!el) return sendBand(0, 0);
  const r = el.getBoundingClientRect();
  sendBand(Math.round(r.top), Math.round(r.bottom));
}

/** A page with no map (v0.812.2): the menu swipe works anywhere. */
export function useNoMap(embed: boolean): void {
  useEffect(() => {
    if (embed && bridge()) sendBand(0, 0);
  }, [embed]);
}

// ---------- Places page (v0.795) ----------
// The page reads and writes through the API on the web too: the API takes the
// web's signed-in parent as well as the app's Places cookie.

export function searchHref(embed: boolean): string {
  return embed ? "/places/embed/search" : "/places/search";
}

/** A history day, with the stop that starts at `stopISO` selected. */
export function dayHref(embed: boolean, personId: string, date: string, stopISO?: string): string {
  return `${placesHref(embed, personId, date)}${stopISO ? `&stop=${encodeURIComponent(stopISO)}` : ""}`;
}

export async function visitsNow(p: {
  q: string;
  users: string[];
  since: string | null;
  until?: string | null;
  place?: string | null;
  offset: number;
}): Promise<VisitSearch> {
  const u = new URLSearchParams({ q: p.q, users: p.users.join(","), offset: String(p.offset) });
  if (p.since) u.set("since", p.since);
  if (p.until) u.set("until", p.until);
  if (p.place) u.set("place", p.place);
  return getJson(`/api/v1/places/view/visits?${u.toString()}`);
}

export async function placesListNow(from?: string | null, to?: string | null): Promise<PlacesList> {
  const u = new URLSearchParams();
  if (from) u.set("from", from);
  if (to) u.set("to", to);
  const qs = u.toString();
  return getJson(`/api/v1/places/view/places${qs ? `?${qs}` : ""}`);
}

export type PlaceChange =
  | { op: "confirm"; spotId: string; kind: string | null; size: "small" | "normal" | "large"; lat?: number; lng?: number }
  | { op: "choose"; visitId: string; placeNameId: string }
  | { op: "move"; visitId: string; name: string; address: string | null; placeId: string | null; lat: number | null; lng: number | null }
  | { op: "update"; placeNameId: string; name?: string; kind?: string | null; size?: "small" | "normal" | "large"; lat?: number; lng?: number };

export async function changePlaceNow(c: PlaceChange): Promise<{ error: string | null }> {
  const res = await fetch("/api/v1/places/view/visits", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-kairos-embed": "1" },
    body: JSON.stringify(c),
  });
  if (!res.ok) return { error: res.status === 403 ? "Only parents can change places." : "Couldn't save. Try again." };
  return (await res.json()) as { error: string | null };
}
