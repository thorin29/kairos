"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Avatar } from "@/components/avatar";
import { CarIcon, MapIcon, MotionIcon, PeopleIcon, WalkIcon, XIcon } from "@/components/icons";
import { metres } from "@/lib/places/geo";
import { liveNow, mapLoaded, placesHref, tracksNow, useEmbed, useMapEdge } from "./embed-context";
import type { LiveData, LivePerson } from "@/lib/places/live-types";
import type { DayData } from "@/lib/places/history-types";
import { drawTrips, loadMaps, touchInline } from "./map-kit";

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

/** Directions to someone: the phone's own maps app inside the app (geo:),
 *  Google Maps in a new tab on the web. */
function directionsHref(embed: boolean, p: LivePerson): string {
  const at = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  if (embed) return `geo:${at}?q=${at}(${encodeURIComponent(p.name)})`;
  return `https://www.google.com/maps/dir/?api=1&destination=${at}`;
}

function placeLine(p: LivePerson): string {
  if (!p.place || p.place.kind === "unknown") return "Unknown place";
  if (p.place.name && p.place.address) return `${p.place.name} · ${p.place.address}`;
  return p.place.name ?? p.place.address ?? "Unknown place";
}

function MotionGlyph({ motion, className }: { motion: LivePerson["motion"]; className: string }) {
  if (motion === "drive") return <CarIcon className={className} />;
  if (motion === "walk") return <WalkIcon className={className} />;
  return <MotionIcon className={className} />;
}

/** Icon plus speed while moving: car 72 mph, a walker, or motion lines + mph. */
function Movement({ p, className = "h-4 w-4" }: { p: LivePerson; className?: string }) {
  const showMph = p.motion !== "walk" && p.mph != null && p.mph > 0;
  return (
    <span className="inline-flex items-center gap-1" aria-label={p.motion === "drive" ? "Driving" : p.motion === "walk" ? "Walking" : "Moving"}>
      <MotionGlyph motion={p.motion} className={className} />
      {showMph && <span className="font-mono">{p.mph} mph</span>}
    </span>
  );
}

function Face({ p }: { p: LivePerson }) {
  return (
    <div className={`flex flex-col items-center ${p.stale ? "opacity-60" : ""}`}>
      <div className="rounded-full bg-white p-[3px] shadow-md">
        <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} avatarPosition={p.avatarPosition} size="md" />
      </div>
      {p.moving && (
        <span className="mt-0.5 rounded-full bg-ink px-1.5 py-0.5 text-[0.65rem] font-semibold leading-4 text-white">
          <Movement p={p} className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

/** Several people in one spot: stacked avatars and how many. */
function ClusterFace({ people }: { people: LivePerson[] }) {
  return (
    <div className="flex items-center rounded-full bg-white py-[3px] pl-[3px] pr-2 shadow-md">
      {people.slice(0, 3).map((p, i) => (
        <span key={p.id} className={i > 0 ? "-ml-4" : undefined}>
          <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} avatarPosition={p.avatarPosition} size="md" />
        </span>
      ))}
      <span className="ml-1.5 font-mono text-sm font-semibold text-ink">{people.length}</span>
    </div>
  );
}

/** Metres one screen pixel covers at a zoom and latitude (Web Mercator). */
function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** People whose markers would overlap at this zoom, grouped. */
function groupPeople(people: LivePerson[], zoom: number | null): LivePerson[][] {
  if (zoom == null) return people.map((p) => [p]);
  const used = new Set<string>();
  const groups: LivePerson[][] = [];
  for (const p of people) {
    if (used.has(p.id)) continue;
    const reach = 46 * metresPerPixel(p.lat, zoom);
    const g = people.filter((q) => !used.has(q.id) && metres(p, q) <= reach);
    for (const q of g) used.add(q.id);
    groups.push(g);
  }
  return groups;
}

const keyOf = (g: LivePerson[]) => g.map((p) => p.id).sort().join("|");

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
export const iconBtn =
  "flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-ink shadow-md hover:border-accent disabled:opacity-50";
export const iconBtnOn =
  "flex h-10 w-10 items-center justify-center rounded-full border border-accent bg-accent text-on-accent shadow-md";

const glyph = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", className: "h-5 w-5", "aria-hidden": true } as const;

const cardIcon = "flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink";

export function ClockGlyph() {
  return (
    <svg {...glyph}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function PencilGlyph() {
  return (
    <svg {...glyph}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function TrashGlyph() {
  return (
    <svg {...glyph}>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5" />
    </svg>
  );
}

export function PinGlyph() {
  return (
    <svg {...glyph}>
      <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </svg>
  );
}

export function NavigateGlyph() {
  return (
    <svg {...glyph}>
      <path d="M21 3 3 10.5l7.5 3 3 7.5L21 3Z" />
    </svg>
  );
}

function RouteGlyph() {
  return (
    <svg {...glyph}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" />
    </svg>
  );
}

function ExpandGlyph() {
  return (
    <svg {...glyph}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

function TrafficGlyph() {
  return (
    <svg {...glyph}>
      <rect x="8" y="2.5" width="8" height="19" rx="3" />
      <circle cx="12" cy="7" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="12" cy="17" r="1.4" />
    </svg>
  );
}

/** On a backpacking trip (v0.778): Tabler's backpack. */
function BackpackGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 18v-6a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z" />
      <path d="M10 6V5a2 2 0 1 1 4 0v1" />
      <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
      <path d="M11 10h2" />
    </svg>
  );
}

/** Terrain (v0.778): Tabler's mountain. */
export function TerrainGlyph() {
  return (
    <svg {...glyph}>
      <path d="M3 20h18l-6.921-14.612a2.3 2.3 0 0 0-4.158 0L3 20Z" />
      <path d="m7.5 11 2 2.5 2.5-2.5 2 3 2.5-2" />
    </svg>
  );
}

export function LayersGlyph() {
  return (
    <svg {...glyph}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}


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
  const embed = useEmbed();
  const [data, setData] = useState<LiveData>(initial);
  const [now, setNow] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [traffic, setTraffic] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [terrain, setTerrain] = useState(false);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tracksOn, setTracksOn] = useState<string[]>([]);
  // The tracks row folds under its icon (v0.790); open when tracks are on.
  const [tracksOpen, setTracksOpen] = useState(false);
  const [tracks, setTracks] = useState<Record<string, DayData>>({});
  const [zoom, setZoom] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const mapDiv = useRef<HTMLDivElement>(null);
  useMapEdge(embed, mapDiv);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markers = useRef(new Map<string, MarkerEntry>());
  const lines = useRef(new Map<string, google.maps.Polyline[]>());
  const info = useRef<google.maps.InfoWindow | null>(null);
  const circle = useRef<google.maps.Circle | null>(null);
  const trafficLayer = useRef<google.maps.TrafficLayer | null>(null);
  const clusters = useRef(new Map<string, { marker: google.maps.marker.AdvancedMarkerElement; root: Root }>());
  const spiderLines = useRef<google.maps.Polyline[]>([]);
  const hub = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  /** People drawn away from their real spot (fanned out) — gliding skips them. */
  const pinned = useRef(new Set<string>());
  const fitted = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const tracksOnRef = useRef(tracksOn);
  tracksOnRef.current = tracksOn;

  // Relative times tick on the client only (no server/client mismatch).
  useEffect(() => {
    setNow(Date.now());
    const saved = readTracks();
    setTracksOn(saved);
    setTracksOpen(saved.length > 0);
    const t = setInterval(() => setNow(Date.now()), POLL_MS);
    return () => clearInterval(t);
  }, []);

  const pullTracks = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setTracks({});
      return;
    }
    try {
      setTracks(await tracksNow(embed, ids));
    } catch {
      // Keep the last tracks.
    }
  }, [embed]);

  // Live refresh while visible; straight away when the tab comes back.
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await liveNow(embed);
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
  }, [pullTracks, embed]);

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
      setMapError("Google refused the map key. Check the key and its website restriction in Admin → Family map.");
    loadMaps(mapKey)
      .then(async () => {
        if (cancelled || !mapDiv.current || mapRef.current) return;
        // Counted before it opens, so Kairos's daily map cap holds (v0.778).
        if (!(await mapLoaded(embed))) {
          if (!cancelled) setMapError("Map paused for today: the daily map limit is used up.");
          return;
        }
        if (cancelled || !mapDiv.current || mapRef.current) return;
        const first = dataRef.current.people[0];
        const map = new google.maps.Map(mapDiv.current, {
          mapId,
          center: first ? { lat: first.lat, lng: first.lng } : { lat: 39.5, lng: -98.35 },
          zoom: first ? 13 : 4,
          // One finger moves the map in the app (v0.794): the page there doesn't
          // scroll, so a one-finger drag can only mean the map.
          gestureHandling: touchInline() && !embed ? "cooperative" : "greedy",
          clickableIcons: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });
        map.addListener("dragstart", () => setFollow(null));
        map.addListener("click", () => setExpanded(null));
        map.addListener("idle", () => setZoom(map.getZoom() ?? null));
        mapRef.current = map;
        info.current = new google.maps.InfoWindow();
        info.current.addListener("closeclick", () => setSelected(null));
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError("The map couldn't load. Check your connection, or the map key in Admin → Family map.");
      });
    return () => {
      cancelled = true;
    };
  }, [mapKey, mapId, embed]);

  const fitEveryone = useCallback(() => {
    const map = mapRef.current;
    const people = dataRef.current.people;
    setFollow(null);
    if (!map || people.length === 0) return;
    const b = new google.maps.LatLngBounds();
    for (const p of people) b.extend({ lat: p.lat, lng: p.lng });
    // Everyone in one spot (all home, v0.790): the neighbourhood, not the
    // rooftop that fitting a few metres would zoom to.
    const c = b.getCenter();
    const spread = Math.max(...people.map((p) => metres({ lat: c.lat(), lng: c.lng() }, p)));
    if (people.length === 1 || spread < 400) {
      map.panTo({ lat: c.lat(), lng: c.lng() });
      map.setZoom(15);
      return;
    }
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
        const id = p.id;
        const step = (t: number) => {
          if (pinned.current.has(id)) {
            entry.frame = null;
            return;
          }
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

  // A fanned-out group folds back when the zoom changes.
  useEffect(() => {
    setExpanded(null);
  }, [zoom]);

  // Group overlapping people; fan a group out when it's tapped.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const groups = groupPeople(data.people, zoom);
    const liveKeys = new Set<string>();
    for (const l of spiderLines.current) l.setMap(null);
    spiderLines.current = [];
    const wasPinned = new Set(pinned.current);
    pinned.current.clear();
    let hubShown = false;

    for (const g of groups) {
      if (g.length === 1) {
        const m = markers.current.get(g[0].id);
        if (m) {
          m.marker.map = map;
          if (wasPinned.has(g[0].id)) m.marker.position = m.pos;
        }
        continue;
      }
      const key = keyOf(g);
      const center = {
        lat: g.reduce((s2, p) => s2 + p.lat, 0) / g.length,
        lng: g.reduce((s2, p) => s2 + p.lng, 0) / g.length,
      };
      if (expanded === key && zoom != null) {
        // Fan out in an arc above the real spot, spaced so avatars never
        // overlap, with straight lines (white-edged, like Google's own) meeting
        // at a dot on the spot.
        const mpp = metresPerPixel(center.lat, zoom);
        const n = g.length;
        const step = n > 1 ? Math.min(50, 150 / (n - 1)) : 0;
        const radiusPx = Math.max(68, n > 1 ? 56 / (2 * Math.sin(((step / 2) * Math.PI) / 180)) : 68);
        const toLatLng = (x: number, y: number) => ({
          lat: center.lat - (y * mpp) / 111_320,
          lng: center.lng + (x * mpp) / (111_320 * Math.cos((center.lat * Math.PI) / 180)),
        });
        g.forEach((p, i) => {
          const deg = -90 - (step * (n - 1)) / 2 + step * i;
          const a = (deg * Math.PI) / 180;
          const x = Math.cos(a) * radiusPx;
          const y = Math.sin(a) * radiusPx;
          const spot = toLatLng(x, y);
          const m = markers.current.get(p.id);
          if (!m) return;
          pinned.current.add(p.id);
          if (m.frame != null) cancelAnimationFrame(m.frame);
          m.frame = null;
          m.marker.map = map;
          m.marker.position = spot;
          const line = [center, spot];
          spiderLines.current.push(
            new google.maps.Polyline({
              map,
              path: line,
              clickable: false,
              strokeColor: "#ffffff",
              strokeOpacity: 1,
              strokeWeight: 6,
              zIndex: 4,
            }),
            new google.maps.Polyline({
              map,
              path: line,
              clickable: false,
              strokeColor: p.color,
              strokeOpacity: 1,
              strokeWeight: 3,
              zIndex: 5,
            }),
          );
        });
        if (!hub.current) {
          const dot = document.createElement("div");
          dot.style.cssText =
            "width:12px;height:12px;border-radius:9999px;background:#10202f;border:2px solid #fff;box-shadow:0 1px 3px rgba(16,32,47,.35);transform:translateY(50%)";
          hub.current = new google.maps.marker.AdvancedMarkerElement({ content: dot, zIndex: 6 });
        }
        hub.current.map = map;
        hub.current.position = center;
        hubShown = true;
        const c = clusters.current.get(key);
        if (c) c.marker.map = null;
        liveKeys.add(key);
        continue;
      }
      for (const p of g) {
        const m = markers.current.get(p.id);
        if (m) m.marker.map = null;
      }
      let c = clusters.current.get(key);
      if (!c) {
        const el = document.createElement("div");
        const root = createRoot(el);
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: center,
          content: el,
          title: g.map((p) => p.name).join(", "),
          zIndex: 200,
          gmpClickable: true,
        });
        marker.addEventListener("gmp-click", () => setExpanded(key));
        c = { marker, root };
        clusters.current.set(key, c);
      }
      c.marker.map = map;
      c.marker.position = center;
      c.root.render(<ClusterFace people={g} />);
      liveKeys.add(key);
    }
    if (!hubShown && hub.current) hub.current.map = null;
    for (const [key, c] of clusters.current) {
      if (liveKeys.has(key)) continue;
      c.marker.map = null;
      const root = c.root;
      setTimeout(() => root.unmount(), 0);
      clusters.current.delete(key);
    }
  }, [data, zoom, expanded, ready]);

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
    // The bubble repeats the person's card, so it shows only in full screen,
    // where the cards are hidden.
    if (!full) info.current?.close();
    const box = document.createElement("div");
    box.style.cssText = "font: 14px/1.35 var(--font-plex-sans, system-ui, sans-serif); color: #10202f; min-width: 180px;";
    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.textContent = p.name;
    // The place line opens directions to them (the phone's maps app in the app).
    const where = document.createElement("a");
    where.href = directionsHref(embed, p);
    if (!embed) {
      where.target = "_blank";
      where.rel = "noreferrer";
    }
    where.style.cssText = "display:block; color: inherit; text-decoration: underline; text-underline-offset: 2px;";
    where.textContent = p.moving
      ? `${p.motion === "drive" ? "Driving" : p.motion === "walk" ? "Walking" : "Moving"}${p.mph != null && p.motion !== "walk" ? ` · ${p.mph} mph` : ""}`
      : placeLine(p);
    const when = document.createElement("div");
    when.style.cssText = "color: #5b6b7d; font-size: 12px; margin-top: 2px;";
    const t = now ?? Date.parse(data.asOf);
    when.textContent =
      p.since && !p.moving ? `Here since ${clock(p.since, t)} · updated ${ago(p.at, t)}` : `Updated ${ago(p.at, t)}`;
    box.append(title, where, when);
    info.current?.setContent(box);
    if (full) info.current?.open({ map, anchor: entry.marker, shouldFocus: false });

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
  }, [selected, data, ready, now, full, embed]);

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

  useEffect(() => {
    if (ready) mapRef.current?.setMapTypeId(satellite ? "hybrid" : terrain ? "terrain" : "roadmap");
  }, [satellite, terrain, ready]);

  // Full screen: same map, grown to the window. Esc closes it.
  useEffect(() => {
    mapRef.current?.setOptions({ gestureHandling: full || embed || !touchInline() ? "greedy" : "cooperative" });
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [full, embed]);

  // Clean up markers and lines when leaving the page.
  useEffect(() => {
    const all = markers.current;
    const allLines = lines.current;
    const allClusters = clusters.current;
    const allSpider = spiderLines;
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
      for (const c of allClusters.values()) {
        c.marker.map = null;
        const root = c.root;
        setTimeout(() => root.unmount(), 0);
      }
      allClusters.clear();
      for (const l of allSpider.current) l.setMap(null);
    };
  }, []);

  const t = now ?? Date.parse(data.asOf);
  const empty = data.people.length === 0;
  const sel = data.people.find((p) => p.id === selected) ?? null;


  return (
    <main className={embed ? "flex h-[100dvh] flex-col px-3 py-3" : "mx-auto max-w-[96rem] px-4 py-6 sm:px-6"}>
      {!embed && <h1 className="mb-4 font-display text-3xl font-semibold tracking-tight">Family map</h1>}

      {/* In the app (v0.793) the page itself doesn't scroll: the map stays put
          and only the people list under it scrolls. */}
      <div className={`flex flex-col gap-4 lg:flex-row lg:items-start ${embed ? "min-h-0 flex-1" : ""}`}>
        <section
          aria-label="Map"
          className={
            full
              ? "fixed inset-0 z-[70] bg-ground"
              : `relative ${embed ? "h-[52dvh] min-h-[300px] shrink-0" : "h-[56vh] min-h-[360px]"} overflow-hidden rounded-2xl border border-hairline bg-surface lg:h-[calc(100dvh-8.5rem)] lg:min-w-0 lg:flex-1`
          }
        >
          <div ref={mapDiv} className="h-full w-full" />

          {data.people.length > 0 && (
            <div className="absolute left-3 top-3 flex max-w-[calc(100%-4.5rem)] items-center rounded-full bg-surface/95 p-0.5 shadow-md">
              {/* Tracks (v0.790): the icon alone; tap it and the people slide
                  out to pick whose tracks to show. Tap it again and they fold
                  back under it, and every track goes. */}
              <button
                type="button"
                onClick={() => {
                  if (tracksOpen) {
                    setTracksOpen(false);
                    setTracksOn([]);
                    writeTracks([]);
                  } else {
                    setTracksOpen(true);
                  }
                }}
                aria-expanded={tracksOpen}
                aria-label={tracksOpen ? "Hide tracks" : "Tracks"}
                title={tracksOpen ? "Hide tracks" : "Tracks"}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                  tracksOpen ? "bg-accent text-on-accent" : "text-ink hover:bg-black/5"
                }`}
              >
                <RouteGlyph />
              </button>
              <div
                className={`flex items-center gap-1 overflow-x-auto transition-[max-width,opacity,padding] duration-300 ease-out ${
                  tracksOpen ? "max-w-[40rem] pl-1 pr-0.5 opacity-100" : "pointer-events-none max-w-0 opacity-0"
                }`}
                aria-hidden={!tracksOpen}
              >
                {data.people.map((p) => {
                  const on = tracksOn.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      tabIndex={tracksOpen ? 0 : -1}
                      onClick={() => toggleTrack(p.id)}
                      aria-pressed={on}
                      aria-label={`${p.name}'s track`}
                      title={p.name}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity ${on ? "" : "opacity-40 grayscale"}`}
                    >
                      <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} avatarPosition={p.avatarPosition} size="xs" />
                    </button>
                  );
                })}
              </div>
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

          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setFull((v) => !v)}
              className={iconBtn}
              aria-label={full ? "Close full screen" : "Full screen"}
              title={full ? "Close full screen" : "Full screen"}
            >
              {full ? <XIcon className="h-5 w-5" /> : <ExpandGlyph />}
            </button>
            <button type="button" onClick={fitEveryone} disabled={empty} className={iconBtn} aria-label="Everyone" title="Everyone">
              <PeopleIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setTraffic((v) => !v)}
              className={traffic ? iconBtnOn : iconBtn}
              aria-pressed={traffic}
              aria-label="Traffic"
              title="Traffic"
            >
              <TrafficGlyph />
            </button>
            <button
              type="button"
              onClick={() => {
                setSatellite((v) => !v);
                setTerrain(false);
              }}
              className={satellite ? iconBtnOn : iconBtn}
              aria-pressed={satellite}
              aria-label="Satellite"
              title="Satellite"
            >
              <LayersGlyph />
            </button>
            <button
              type="button"
              onClick={() => {
                setTerrain((v) => !v);
                setSatellite(false);
              }}
              className={terrain ? iconBtnOn : iconBtn}
              aria-pressed={terrain}
              aria-label="Terrain"
              title="Terrain"
            >
              <TerrainGlyph />
            </button>
          </div>
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

        <aside aria-label="People" className={`space-y-2 lg:w-80 lg:shrink-0 ${embed ? "min-h-0 flex-1 overflow-y-auto pb-1" : ""}`}>
          {data.people.map((p) => {
            const isSel = p.id === selected;
            const lowBattery = p.battery != null && p.battery < 20;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border transition-colors ${
                  p.stale ? "border-amber-200 bg-amber-50" : "border-hairline bg-surface hover:border-accent"
                }`}
                // A light tint of where they are (v0.779): the zone's colour,
                // coral when in no zone. A stale phone stays amber.
                style={{
                  ...(!p.stale && p.look ? { backgroundColor: `${p.look.color}1F`, borderColor: `${p.look.color}55` } : {}),
                  ...(isSel ? { borderColor: p.color, boxShadow: `0 0 0 1px ${p.color}` } : {}),
                }}
              >
                <div className="flex items-stretch">
                <button type="button" onClick={() => choose(p)} className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-3 text-left">
                  <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} avatarPosition={p.avatarPosition} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-semibold">{p.name}</span>
                        {p.backpacking && (
                          <span className="shrink-0 text-muted" title="Backpacking" aria-label="Backpacking">
                            <BackpackGlyph />
                          </span>
                        )}
                      </span>
                      {now != null && !p.moving && p.since && (
                        <span className="shrink-0 text-xs text-muted">{span(p.since, t)}</span>
                      )}
                    </span>
                    {p.moving ? (
                      <span className="block text-sm font-semibold">
                        <Movement p={p} />
                      </span>
                    ) : (
                      <span className="flex min-w-0 items-center gap-1.5 text-sm">
                        {p.look?.icon && (
                          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill={p.look.color} aria-hidden>
                            <path d={p.look.icon} />
                          </svg>
                        )}
                        <span className="truncate">{placeLine(p)}</span>
                      </span>
                    )}
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
                <div className="flex shrink-0 flex-col items-center justify-start gap-1 py-2 pl-1 pr-2">
                  <Link href={placesHref(embed, p.id)} className={cardIcon} aria-label={`${p.name}'s day`} title="History">
                    <ClockGlyph />
                  </Link>
                  <a
                    href={directionsHref(embed, p)}
                    {...(embed ? {} : { target: "_blank", rel: "noreferrer" })}
                    className={cardIcon}
                    aria-label={`Directions to ${p.name}`}
                    title="Directions"
                  >
                    <NavigateGlyph />
                  </a>
                </div>
                </div>
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

    </main>
  );
}
