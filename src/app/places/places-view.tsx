"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Avatar } from "@/components/avatar";
import { MapIcon } from "@/components/icons";
import { notePlacesMapLoad, placesTracks, refreshPlacesLive } from "@/lib/actions/places-live";
import type { LiveData, LivePerson } from "@/lib/places/live-types";
import type { DayData } from "@/lib/places/history-types";
import { drawTrips, loadMaps, touchInline } from "./map-kit";
import { PlaceFix } from "./place-fix";

/**
 * Places: one Google map with everyone, and a list beside it.
 *
 * Smoothness and cost: the map is created once per visit (Google bills per
 * map load) and never rebuilt — refreshes only move markers, gliding them to
 * their new spot. Kairos is asked every 30 s while the tab is visible (that
 * never calls Google). The view isn't re-fitted after the first load, so it
 * stays where you've panned. Full screen is the same map grown to the window.
 * Tracks (today, per person) and Follow ride on the same refresh.
 */

const POLL_MS = 30_000;
const GLIDE_MS = 900;
const TRACKS_KEY = "kairos.places.tracks";

function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

function span(fromIso: string, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(fromIso).getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${min % 60} min`;
  return `${Math.floor(h / 24)} d`;
}

function clock(iso: string, now: number): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sameDay = new Date(now).toDateString() === d.toDateString();
  return sameDay ? time : `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

function driving(p: LivePerson): boolean {
  return p.moving && p.mph != null && p.mph >= 10;
}

function placeLine(p: LivePerson): string {
  if (p.moving) return driving(p) ? "Driving" : "On the move";
  if (!p.place || p.place.kind === "unknown") return "Unknown place";
  if (p.place.name && p.place.address) return `${p.place.name} · ${p.place.address}`;
  return p.place.name ?? p.place.address ?? "Unknown place";
}

function speedTag(p: LivePerson): string {
  return p.mph != null && p.mph > 0 ? `${p.mph} mph` : "Moving";
}

function Face({ p }: { p: LivePerson }) {
  return (
    <div className={`flex flex-col items-center ${p.stale ? "opacity-60" : ""}`}>
      <div className="rounded-full bg-white p-[3px] shadow-md">
        <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} avatarPosition={p.avatarPosition} size="md" />
      </div>
      {p.moving && (
        <span className="mt-0.5 rounded-full bg-ink px-1.5 font-mono text-[0.65rem] font-semibold leading-4 text-white">
          {speedTag(p)}
        </span>
      )}
    </div>
  );
}

type MarkerEntry = {
  marker: google.maps.marker.AdvancedMarkerElement;
  root: Root;
  pos: google.maps.LatLngLiteral;
  frame: number | null;
};

const btn =
  "inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-sm font-medium shadow-sm hover:border-accent disabled:opacity-50";
const btnOn =
  "inline-flex h-10 items-center gap-2 rounded-full border border-accent bg-accent px-4 text-sm font-medium text-on-accent shadow-sm";
const small =
  "inline-flex h-9 items-center rounded-full border border-hairline bg-surface px-3 text-xs font-medium hover:border-accent";

function readTracks(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(TRACKS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeTracks(ids: string[]) {
  try {
    localStorage.setItem(TRACKS_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable: tracks just reset next visit.
  }
}

export function PlacesView({ mapKey, mapId, initial }: { mapKey: string; mapId: string; initial: LiveData }) {
  const [data, setData] = useState<LiveData>(initial);
  const [now, setNow] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [traffic, setTraffic] = useState(false);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tracksOn, setTracksOn] = useState<string[]>([]);
  const [tracks, setTracks] = useState<Record<string, DayData>>({});
  const [fixing, setFixing] = useState<LivePerson | null>(null);

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markers = useRef(new Map<string, MarkerEntry>());
  const lines = useRef(new Map<string, google.maps.Polyline[]>());
  const info = useRef<google.maps.InfoWindow | null>(null);
  const circle = useRef<google.maps.Circle | null>(null);
  const trafficLayer = useRef<google.maps.TrafficLayer | null>(null);
  const fitted = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const tracksOnRef = useRef(tracksOn);
  tracksOnRef.current = tracksOn;

  // Relative times tick on the client only (no server/client mismatch).
  useEffect(() => {
    setNow(Date.now());
    setTracksOn(readTracks());
    const t = setInterval(() => setNow(Date.now()), POLL_MS);
    return () => clearInterval(t);
  }, []);

  const pullTracks = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setTracks({});
      return;
    }
    try {
      setTracks(await placesTracks(ids));
    } catch {
      // Keep the last tracks.
    }
  }, []);

  // Live refresh while visible; straight away when the tab comes back.
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await refreshPlacesLive();
        if (alive) {
          setData(next);
          setNow(Date.now());
        }
      } catch {
        // Offline or signed out: keep showing the last good data.
      }
      if (alive) void pullTracks(tracksOnRef.current);
    };
    const t = setInterval(pull, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pullTracks]);

  // Tracks switched on/off: fetch straight away.
  useEffect(() => {
    void pullTracks(tracksOn);
  }, [tracksOn, pullTracks]);

  const toggleTrack = (id: string) => {
    const next = tracksOn.includes(id) ? tracksOn.filter((x) => x !== id) : [...tracksOn, id];
    setTracksOn(next);
    writeTracks(next);
  };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () =>
      setMapError("Google refused the map key. Check the key and its website restriction in Admin → Places.");
    loadMaps(mapKey)
      .then(() => {
        if (cancelled || !mapDiv.current || mapRef.current) return;
        const first = dataRef.current.people[0];
        const map = new google.maps.Map(mapDiv.current, {
          mapId,
          center: first ? { lat: first.lat, lng: first.lng } : { lat: 39.5, lng: -98.35 },
          zoom: first ? 13 : 4,
          gestureHandling: touchInline() ? "cooperative" : "greedy",
          clickableIcons: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });
        map.addListener("dragstart", () => setFollow(null));
        mapRef.current = map;
        info.current = new google.maps.InfoWindow();
        info.current.addListener("closeclick", () => setSelected(null));
        setReady(true);
        void notePlacesMapLoad().catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setMapError("The map couldn't load. Check your connection, or the map key in Admin → Places.");
      });
    return () => {
      cancelled = true;
    };
  }, [mapKey, mapId]);

  const fitEveryone = useCallback(() => {
    const map = mapRef.current;
    const people = dataRef.current.people;
    setFollow(null);
    if (!map || people.length === 0) return;
    if (people.length === 1) {
      map.panTo({ lat: people[0].lat, lng: people[0].lng });
      map.setZoom(15);
      return;
    }
    const b = new google.maps.LatLngBounds();
    for (const p of people) b.extend({ lat: p.lat, lng: p.lng });
    map.fitBounds(b, 64);
  }, []);

  // Place, glide and redraw markers whenever the data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const seen = new Set<string>();
    data.people.forEach((p, i) => {
      seen.add(p.id);
      const to = { lat: p.lat, lng: p.lng };
      let m = markers.current.get(p.id);
      if (!m) {
        const el = document.createElement("div");
        const root = createRoot(el);
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: to,
          content: el,
          title: p.name,
          zIndex: 100 - i,
          gmpClickable: true,
        });
        marker.addEventListener("gmp-click", () => setSelected(p.id));
        m = { marker, root, pos: to, frame: null };
        markers.current.set(p.id, m);
      } else if (m.pos.lat !== to.lat || m.pos.lng !== to.lng) {
        const entry = m;
        const from = { ...entry.pos };
        const start = performance.now();
        if (entry.frame != null) cancelAnimationFrame(entry.frame);
        const step = (t: number) => {
          const k = Math.min(1, (t - start) / GLIDE_MS);
          const e = 1 - (1 - k) ** 3;
          entry.marker.position = { lat: from.lat + (to.lat - from.lat) * e, lng: from.lng + (to.lng - from.lng) * e };
          entry.frame = k < 1 ? requestAnimationFrame(step) : null;
        };
        entry.frame = requestAnimationFrame(step);
        entry.pos = to;
      }
      m.root.render(<Face p={p} />);
    });
    for (const [id, m] of markers.current) {
      if (seen.has(id)) continue;
      if (m.frame != null) cancelAnimationFrame(m.frame);
      m.marker.map = null;
      const root = m.root;
      setTimeout(() => root.unmount(), 0);
      markers.current.delete(id);
    }
    if (!fitted.current && data.people.length > 0) {
      fitted.current = true;
      fitEveryone();
    }
    // Following someone: keep them in view as they move.
    const f = follow ? data.people.find((p) => p.id === follow) : null;
    if (f) map.panTo({ lat: f.lat, lng: f.lng });
  }, [data, ready, fitEveryone, follow]);

  // Today's tracks for the people switched on.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const ls of lines.current.values()) for (const l of ls) l.setMap(null);
    lines.current.clear();
    for (const id of tracksOn) {
      const day = tracks[id];
      const person = data.people.find((p) => p.id === id);
      if (!day || !person) continue;
      lines.current.set(id, drawTrips(map, day.items, person.color));
    }
  }, [tracks, tracksOn, ready, data.people]);

  // The selected person's bubble and accuracy ring.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const p = data.people.find((x) => x.id === selected);
    const entry = p ? markers.current.get(p.id) : null;
    if (!p || !entry) {
      info.current?.close();
      circle.current?.setMap(null);
      return;
    }
    const box = document.createElement("div");
    box.style.cssText = "font: 14px/1.35 var(--font-plex-sans, system-ui, sans-serif); color: #10202f; min-width: 180px;";
    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.textContent = p.name;
    const where = document.createElement("div");
    where.textContent = p.moving && p.mph != null ? `${placeLine(p)} · ${p.mph} mph` : placeLine(p);
    const when = document.createElement("div");
    when.style.cssText = "color: #5b6b7d; font-size: 12px; margin-top: 2px;";
    const t = now ?? Date.parse(data.asOf);
    when.textContent =
      p.since && !p.moving ? `Here since ${clock(p.since, t)} · updated ${ago(p.at, t)}` : `Updated ${ago(p.at, t)}`;
    box.append(title, where, when);
    info.current?.setContent(box);
    info.current?.open({ map, anchor: entry.marker, shouldFocus: false });

    if (p.accuracyM && p.accuracyM > 15) {
      if (!circle.current) {
        circle.current = new google.maps.Circle({ clickable: false, strokeWeight: 1, strokeOpacity: 0.5, fillOpacity: 0.12 });
      }
      circle.current.setOptions({
        map,
        center: { lat: p.lat, lng: p.lng },
        radius: p.accuracyM,
        strokeColor: p.color,
        fillColor: p.color,
      });
    } else {
      circle.current?.setMap(null);
    }
  }, [selected, data, ready, now]);

  const choose = (p: LivePerson) => {
    setSelected(p.id);
    if (follow && follow !== p.id) setFollow(null);
    mapRef.current?.panTo({ lat: p.lat, lng: p.lng });
    if ((mapRef.current?.getZoom() ?? 0) < 14) mapRef.current?.setZoom(15);
  };

  // Traffic layer on demand.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (traffic) {
      trafficLayer.current ??= new google.maps.TrafficLayer();
      trafficLayer.current.setMap(map);
    } else {
      trafficLayer.current?.setMap(null);
    }
  }, [traffic, ready]);

  // Full screen: same map, grown to the window. Esc closes it.
  useEffect(() => {
    mapRef.current?.setOptions({ gestureHandling: full || !touchInline() ? "greedy" : "cooperative" });
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !fixing) setFull(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [full, fixing]);

  // Clean up markers and lines when leaving the page.
  useEffect(() => {
    const all = markers.current;
    const allLines = lines.current;
    return () => {
      for (const m of all.values()) {
        if (m.frame != null) cancelAnimationFrame(m.frame);
        m.marker.map = null;
        const root = m.root;
        setTimeout(() => root.unmount(), 0);
      }
      all.clear();
      for (const ls of allLines.values()) for (const l of ls) l.setMap(null);
      allLines.clear();
    };
  }, []);

  const t = now ?? Date.parse(data.asOf);
  const empty = data.people.length === 0;
  const sel = data.people.find((p) => p.id === selected) ?? null;

  const refreshNow = async () => {
    try {
      setData(await refreshPlacesLive());
    } catch {
      // ignore
    }
  };

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Places</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTraffic((v) => !v)} className={traffic ? btnOn : btn} aria-pressed={traffic}>
            Traffic
          </button>
          <button type="button" onClick={fitEveryone} disabled={empty} className={btn}>
            Everyone
          </button>
          <button type="button" onClick={() => setFull(true)} className={btn}>
            Full screen
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section
          aria-label="Map"
          className={
            full
              ? "fixed inset-0 z-[70] bg-ground"
              : "relative h-[56vh] min-h-[360px] overflow-hidden rounded-2xl border border-hairline bg-surface lg:h-[calc(100dvh-8.5rem)] lg:min-w-0 lg:flex-1"
          }
        >
          <div ref={mapDiv} className="h-full w-full" />

          {data.people.length > 0 && (
            <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 rounded-full bg-surface/95 py-1 pl-3 pr-1.5 shadow-md">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">Tracks</span>
              {data.people.map((p) => {
                const on = tracksOn.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleTrack(p.id)}
                    aria-pressed={on}
                    aria-label={`${p.name}'s track`}
                    title={p.name}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-opacity ${on ? "" : "opacity-40 grayscale"}`}
                  >
                    <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} avatarPosition={p.avatarPosition} size="xs" />
                  </button>
                );
              })}
            </div>
          )}

          {sel && (
            <div className="absolute bottom-6 left-3">
              <button
                type="button"
                onClick={() => setFollow(follow === sel.id ? null : sel.id)}
                aria-pressed={follow === sel.id}
                className={follow === sel.id ? btnOn : btn}
              >
                {follow === sel.id ? `Following ${sel.name}` : `Follow ${sel.name}`}
              </button>
            </div>
          )}

          {full && (
            <div className="absolute right-3 top-3 flex gap-2">
              <button type="button" onClick={fitEveryone} className={btn}>
                Everyone
              </button>
              <button type="button" onClick={() => setFull(false)} className={btn} aria-label="Close full screen">
                Close
              </button>
            </div>
          )}
          {(mapError || !ready || empty) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto max-w-sm rounded-xl border border-hairline bg-surface px-4 py-3 text-center text-sm shadow-sm">
                {mapError ? (
                  <span className="text-red-700">{mapError}</span>
                ) : !ready ? (
                  <span className="inline-flex items-center gap-2 text-muted">
                    <MapIcon className="h-4 w-4" /> Loading map…
                  </span>
                ) : (
                  <span className="text-muted">No locations yet.</span>
                )}
              </div>
            </div>
          )}
        </section>

        <aside aria-label="People" className="space-y-2 lg:w-80 lg:shrink-0">
          {data.people.map((p) => {
            const isSel = p.id === selected;
            const lowBattery = p.battery != null && p.battery < 20;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border transition-colors ${
                  p.stale ? "border-amber-200 bg-amber-50" : "border-hairline bg-surface hover:border-accent"
                }`}
                style={isSel ? { borderColor: p.color, boxShadow: `0 0 0 1px ${p.color}` } : undefined}
              >
                <button type="button" onClick={() => choose(p)} className="flex w-full items-start gap-3 px-3 py-3 text-left">
                  <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} avatarPosition={p.avatarPosition} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{p.name}</span>
                      {now != null && (
                        <span className={`shrink-0 text-xs ${p.moving ? "font-mono font-semibold text-ink" : "text-muted"}`}>
                          {p.moving ? speedTag(p) : p.since ? span(p.since, t) : ""}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-sm">{placeLine(p)}</span>
                    {now != null && (
                      <span className={`block font-mono text-xs ${p.stale ? "text-amber-800" : "text-muted"}`}>
                        {p.stale ? `No update ${ago(p.at, t)}` : `Updated ${ago(p.at, t)} · ${clock(p.at, t)}`}
                        {p.battery != null && (
                          <>
                            {" · "}
                            <span className={lowBattery ? "text-red-700" : undefined}>{p.battery}%</span>
                          </>
                        )}
                      </span>
                    )}
                  </span>
                </button>
                {isSel && (
                  <div className="flex flex-wrap gap-2 px-3 pb-3 pl-[4.25rem]">
                    <Link href={`/places/${p.id}`} className={small}>
                      History
                    </Link>
                    {!p.moving && (
                      <button type="button" onClick={() => setFixing(p)} className={small}>
                        Not right?
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {data.waiting.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-3 py-3 opacity-70">
              <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} avatarPosition={p.avatarPosition} size="md" />
              <span>
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-sm text-muted">No location yet</span>
              </span>
            </div>
          ))}
        </aside>
      </div>

      {fixing && (
        <PlaceFix
          personId={fixing.id}
          personName={fixing.name}
          spot={{ lat: fixing.lat, lng: fixing.lng, accuracyM: fixing.accuracyM }}
          onClose={() => setFixing(null)}
          onSaved={() => void refreshNow()}
        />
      )}
    </main>
  );
}
