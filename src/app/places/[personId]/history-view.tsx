"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CarIcon, DumbbellIcon, MapIcon, MotionIcon, WalkIcon } from "@/components/icons";
import { changeStopNow, mapLoaded, placesHref, useEmbed, useMapEdge, type StopChange } from "../embed-context";
import type { DayData, DayItem, DayLegItem, DayStopItem } from "@/lib/places/history-types";
import { drawTrips, loadMaps, touchInline } from "../map-kit";
import { PlaceFix } from "../place-fix";
import { AddStop } from "./add-stop";
import { metres } from "@/lib/places/geo";
import { LayersGlyph, PencilGlyph, PinGlyph, TerrainGlyph, TrashGlyph, iconBtn, iconBtnOn } from "../places-view";

/**
 * A person's day: totals, the map with their trips (drives on the roads,
 * walks dotted) and numbered stops, a timeline, and replay. The map is made
 * once; stepping to another day only redraws the lines and pins.
 */

type Person = { id: string; name: string; color: string; avatarPath: string | null; avatarPosition: string };

const btn =
  "inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-sm font-medium shadow-sm hover:border-accent disabled:opacity-50";
const small =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 text-xs font-medium hover:border-accent";

const SPEEDS = [30, 120, 480] as const;
/** Time a stop takes during replay, in replay milliseconds. */
const STOP_PAUSE_MS = 600;

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Fit a set of points (v0.794): under 400 m centres at zoom 15 — fitBounds on a
 *  near-point goes to max zoom and a following setZoom is overridden — else
 *  fits them, never closer than zoom 17. */
function fitPoints(map: google.maps.Map, b: google.maps.LatLngBounds): void {
  const ne = b.getNorthEast();
  const sw = b.getSouthWest();
  if (metres({ lat: ne.lat(), lng: ne.lng() }, { lat: sw.lat(), lng: sw.lng() }) < 400) {
    map.setCenter(b.getCenter());
    map.setZoom(15);
    return;
  }
  map.fitBounds(b, 56);
  const once = map.addListener("idle", () => {
    once.remove();
    if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
  });
}

/** Fade a drawn trip (v0.794), or bring it back to how it was drawn. */
const drawn = new WeakMap<google.maps.Polyline, { strokeOpacity: number; icons: google.maps.IconSequence[] | null }>();
function fadeLine(line: google.maps.Polyline, faded: boolean): void {
  let base = drawn.get(line);
  if (!base) {
    base = { strokeOpacity: (line.get("strokeOpacity") as number | undefined) ?? 1, icons: (line.get("icons") as google.maps.IconSequence[] | undefined) ?? null };
    drawn.set(line, base);
  }
  const k = faded ? 0.22 : 1;
  line.setOptions({
    strokeOpacity: base.strokeOpacity * k,
    icons: base.icons?.map((ic) => ({ ...ic, icon: ic.icon ? { ...ic.icon, strokeOpacity: (ic.icon.strokeOpacity ?? 1) * k } : ic.icon })) ?? null,
  });
}

function dateLabel(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === shiftDate(today, -1)) return "Yesterday";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function minutes(fromIso: string, toIso: string): string {
  const min = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function miles(m: number): string {
  const mi = m / 1609.344;
  return mi < 0.1 ? "<0.1 mi" : `${mi.toFixed(1)} mi`;
}

function stopName(s: DayStopItem): string {
  if (!s.place || s.place.kind === "unknown") return "Unknown place";
  return s.place.name ?? s.place.address ?? "Unknown place";
}

/** Replay timeline: trips at their real pace (sped up); each stop a short pause. */
type Frame = { lat: number; lng: number; real: number; v: number };

function buildFrames(items: DayItem[]): Frame[] {
  const frames: Frame[] = [];
  let v = 0;
  for (const it of items) {
    if (it.kind === "stop") {
      v += STOP_PAUSE_MS;
      continue;
    }
    const leg = it as DayLegItem;
    const t0 = leg.times[0] ?? Date.parse(leg.start);
    leg.raw.forEach(([lat, lng], i) => {
      const real = leg.times[i] ?? t0;
      frames.push({ lat, lng, real, v: v + (real - t0) });
    });
    v += (leg.times[leg.times.length - 1] ?? t0) - t0;
  }
  return frames;
}

export function HistoryView({
  mapKey,
  mapId,
  person,
  day,
  today,
  canEdit = false,
}: {
  mapKey: string;
  mapId: string;
  person: Person;
  day: DayData;
  today: string;
  /** Parents can correct the day: rename, remove or add stops (v0.769). */
  canEdit?: boolean;
}) {
  const router = useRouter();
  const embed = useEmbed();
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [removing, setRemoving] = useState<DayStopItem | null>(null);
  const [fixing, setFixing] = useState<DayStopItem | null>(null);
  /** Adding a stop on a trip: its times, middle and search reach. */
  const [adding, setAdding] = useState<{ from: string; to: string; middle: { lat: number; lng: number }; radiusM: number } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(SPEEDS[1]);
  const [replayAt, setReplayAt] = useState<number | null>(null);

  const mapDiv = useRef<HTMLDivElement>(null);
  useMapEdge(embed, mapDiv);
  const mapRef = useRef<google.maps.Map | null>(null);
  const lines = useRef<google.maps.Polyline[]>([]);
  const pins = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const ghost = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const vRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const [layer, setLayer] = useState<"map" | "satellite" | "terrain">("map");
  useEffect(() => {
    if (ready) mapRef.current?.setMapTypeId(layer === "satellite" ? "hybrid" : layer === "terrain" ? "terrain" : "roadmap");
  }, [layer, ready]);
  const stops = useMemo(() => day.items.filter((i): i is DayStopItem => i.kind === "stop"), [day]);
  const frames = useMemo(() => buildFrames(day.items), [day]);
  const hasTrips = frames.length >= 2;

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
        mapRef.current = new google.maps.Map(mapDiv.current, {
          mapId,
          center: { lat: 39.5, lng: -98.35 },
          zoom: 4,
          // One finger moves the map in the app (v0.794): the page there doesn't
          // scroll, so a one-finger drag can only mean the map.
          gestureHandling: touchInline() && !embed ? "cooperative" : "greedy",
          clickableIcons: true,
          // Satellite and terrain are icons (v0.790), as on the live map.
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError("The map couldn't load. Check your connection, or the map key in Admin → Family map.");
      });
    return () => {
      cancelled = true;
    };
  }, [mapKey, mapId, embed]);

  const change = async (c: StopChange) => {
    setEditError(null);
    const res = await changeStopNow(embed, c);
    if (res.error) {
      setEditError(res.error);
      return res.error;
    }
    setSelected(null);
    router.refresh();
    return null;
  };

  const startAdding = (leg: DayLegItem) => {
    const pts = leg.raw.length > 0 ? leg.raw : leg.path;
    if (pts.length === 0) return;
    const mid = pts[Math.floor(pts.length / 2)];
    const ends = metres({ lat: pts[0][0], lng: pts[0][1] }, { lat: pts[pts.length - 1][0], lng: pts[pts.length - 1][1] });
    setAdding({
      from: leg.start,
      to: leg.end,
      middle: { lat: mid[0], lng: mid[1] },
      radiusM: Math.min(5000, Math.max(500, ends / 2 + 300)),
    });
  };

  // Draw the day: trips, numbered stops, then fit it all in view.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const l of lines.current) l.setMap(null);
    for (const p of pins.current) p.map = null;
    lines.current = drawTrips(map, day.items, person.color);
    pins.current = stops.map((s) => {
      const el = document.createElement("div");
      el.textContent = String(s.n);
      el.style.cssText = `width:28px;height:28px;border-radius:9999px;background:#fff;border:3px solid ${person.color};display:flex;align-items:center;justify-content:center;font:600 12px var(--font-plex-mono, monospace);color:#10202f;box-shadow:0 1px 4px rgba(16,32,47,.3)`;
      const pin = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: s.lat, lng: s.lng },
        content: el,
        title: stopName(s),
        gmpClickable: true,
      });
      pin.addEventListener("gmp-click", () => setSelected((cur) => (cur === s.n ? null : s.n)));
      return pin;
    });
    const b = new google.maps.LatLngBounds();
    let any = false;
    for (const it of day.items) {
      if (it.kind === "stop") {
        b.extend({ lat: it.lat, lng: it.lng });
        any = true;
      } else {
        for (const [lat, lng] of it.path) b.extend({ lat, lng });
        any = any || it.path.length > 0;
      }
    }
    if (any) {
      // A day within a few hundred metres opens at neighbourhood zoom (v0.793).
      fitPoints(map, b);
    } else if (day.lastSeen) {
      // Nothing that day (v0.790): open where they were last seen.
      map.setCenter(day.lastSeen);
      map.setZoom(13);
    }
  }, [day, ready, person.color, stops, hasTrips]);

  // Replay: a ghost avatar moving along the day's trips.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!playing) {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      return;
    }
    if (!ghost.current) {
      const el = document.createElement("div");
      el.style.cssText = `width:18px;height:18px;border-radius:9999px;background:${person.color};border:3px solid #fff;box-shadow:0 1px 6px rgba(16,32,47,.4)`;
      ghost.current = new google.maps.marker.AdvancedMarkerElement({ map, content: el, zIndex: 1000 });
    }
    ghost.current.map = map;
    const total = frames[frames.length - 1]?.v ?? 0;
    let last = performance.now();
    let lastPan = 0;
    const step = (now: number) => {
      vRef.current = Math.min(total, vRef.current + (now - last) * speed);
      last = now;
      let i = frames.findIndex((f) => f.v >= vRef.current);
      if (i <= 0) i = 1;
      const a = frames[i - 1];
      const b = frames[i] ?? a;
      const k = b.v === a.v ? 1 : (vRef.current - a.v) / (b.v - a.v);
      const pos = { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k };
      if (ghost.current) ghost.current.position = pos;
      if (now - lastPan > 1000) {
        lastPan = now;
        if (!map.getBounds()?.contains(pos)) map.panTo(pos);
      }
      setReplayAt(a.real + (b.real - a.real) * k);
      if (vRef.current >= total) {
        setPlaying(false);
        vRef.current = 0;
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [playing, speed, frames, ready, person.color]);

  // From the Places page (v0.795): ?stop=<arrival time> opens with that stop selected.
  const wantStop = useSearchParams().get("stop");
  useEffect(() => {
    if (!wantStop || !ready) return;
    const t = Date.parse(wantStop);
    if (Number.isNaN(t)) return;
    const hit = stops.find((s) => Math.abs(Date.parse(s.start) - t) < 15 * 60_000) ?? stops.find((s) => Date.parse(s.start) <= t && t <= Date.parse(s.end));
    if (hit) setSelected(hit.n);
  }, [wantStop, ready, stops]);

  // A new day resets replay.
  useEffect(() => {
    setPlaying(false);
    setReplayAt(null);
    setSelected(null);
    vRef.current = 0;
    if (ghost.current) ghost.current.map = null;
  }, [day.date]);

  // Tapping a stop (v0.794) shows the trip that leaves it — #1 shows the way
  // from #1 to #2, an out-and-back with no stop shows the whole loop — with
  // the day's other trips faded. Tapping it again shows the whole day.
  const focusStop = (s: DayStopItem) => setSelected((cur) => (cur === s.n ? null : s.n));
  const wasSelected = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    // Which drawn line belongs to which item: drawTrips draws, in order, every
    // trip with a path of two or more points.
    const lineItem = day.items.flatMap((it, i) => (it.kind !== "stop" && it.path.length >= 2 ? [i] : []));
    const at = selected == null ? -1 : day.items.findIndex((it) => it.kind === "stop" && it.n === selected);
    if (at < 0) {
      lines.current.forEach((l) => fadeLine(l, false));
      if (wasSelected.current != null) {
        // Back to the whole day.
        const b = new google.maps.LatLngBounds();
        let any = false;
        for (const it of day.items) {
          if (it.kind === "stop") b.extend({ lat: it.lat, lng: it.lng });
          else for (const [lat, lng] of it.path) b.extend({ lat, lng });
          any = true;
        }
        if (any) fitPoints(map, b);
      }
      wasSelected.current = null;
      return;
    }
    wasSelected.current = selected;
    const stop = day.items[at] as DayStopItem;
    let end = at + 1;
    while (end < day.items.length && day.items[end].kind !== "stop") end++;
    const trip = new Set<number>();
    for (let i = at + 1; i < end; i++) trip.add(i);
    lines.current.forEach((l, k) => fadeLine(l, trip.size > 0 && !trip.has(lineItem[k])));
    if (trip.size === 0) {
      // The day's last stop: nothing leaves it, so show the stop itself.
      map.panTo({ lat: stop.lat, lng: stop.lng });
      if ((map.getZoom() ?? 0) < 15) map.setZoom(16);
      return;
    }
    const b = new google.maps.LatLngBounds();
    b.extend({ lat: stop.lat, lng: stop.lng });
    for (const i of trip) {
      const it = day.items[i];
      if (it.kind !== "stop") for (const [lat, lng] of it.path) b.extend({ lat, lng });
    }
    const nextStop = day.items[end];
    if (nextStop && nextStop.kind === "stop") b.extend({ lat: nextStop.lat, lng: nextStop.lng });
    fitPoints(map, b);
  }, [selected, ready, day]);

  const prev = shiftDate(day.date, -1);
  const next = shiftDate(day.date, 1);
  const t = day.totals;

  return (
    <main className={embed ? "flex h-[100dvh] flex-col px-3 py-3" : "mx-auto max-w-[96rem] px-4 py-6 sm:px-6"}>
      {/* v0.793: the name sits on the map; the day's facts and the day picker
          sit in one row under it. The map and that row stay put — in the app
          the page doesn't scroll at all, only the timeline does (beside them
          on a wide screen). */}
      <div
        className={`flex flex-col gap-3 lg:flex-row lg:items-stretch ${
          embed ? "min-h-0 flex-1" : "lg:h-[calc(100dvh-6rem)]"
        }`}
      >
        <div className={`flex shrink-0 flex-col gap-2 lg:min-w-0 lg:flex-1 ${embed ? "" : "sticky top-0 z-10 bg-ground pb-1 lg:static"}`}>
        <section
          aria-label="Map"
          className="relative h-[46vh] min-h-[280px] shrink-0 overflow-hidden rounded-2xl border border-hairline bg-surface lg:h-auto lg:flex-1"
        >
          <div ref={mapDiv} className="h-full w-full" />
          <div className="absolute left-3 top-3 flex max-w-[calc(100%-5rem)] items-center gap-1.5 rounded-full bg-surface/95 py-1 pl-1 pr-3 shadow-md">
            <Link
              href={placesHref(embed)}
              aria-label="Back to Family map"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg hover:bg-black/5"
            >
              ‹
            </Link>
            <Avatar name={person.name} color={person.color} avatarPath={person.avatarPath} avatarPosition={person.avatarPosition} size="xs" />
            <h1 className="truncate text-sm font-semibold">{person.name}</h1>
          </div>
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            {/* One button cycles map → satellite → terrain (v0.795). */}
            <button
              type="button"
              onClick={() => setLayer(layer === "map" ? "satellite" : layer === "satellite" ? "terrain" : "map")}
              className={layer === "map" ? iconBtn : iconBtnOn}
              aria-label={`Map style: ${layer}. Change`}
              title={layer === "satellite" ? "Satellite (tap for terrain)" : layer === "terrain" ? "Terrain (tap for map)" : "Map (tap for satellite)"}
            >
              {layer === "terrain" ? <TerrainGlyph /> : <LayersGlyph />}
            </button>
          </div>
          {hasTrips && (
            <div className="absolute bottom-6 left-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPlaying((v) => !v)} className={btn}>
                {playing ? "Pause" : "Replay"}
              </button>
              <button
                type="button"
                onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
                className={btn}
                aria-label="Replay speed"
              >
                {speed}×
              </button>
              {replayAt != null && (
                <span className="rounded-full bg-surface px-3 py-1 font-mono text-xs shadow-sm">
                  {new Date(replayAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
          )}
          {(mapError || !ready || day.items.length === 0) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto max-w-sm rounded-xl border border-hairline bg-surface px-4 py-3 text-center text-sm shadow-sm">
                {mapError ? (
                  <span className="text-red-700">{mapError}</span>
                ) : !ready ? (
                  <span className="inline-flex items-center gap-2 text-muted">
                    <MapIcon className="h-4 w-4" /> Loading map…
                  </span>
                ) : (
                  <span className="text-muted">No locations this day.</span>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="flex items-center gap-2">
          {/* The day's facts in one strip (v0.793): miles driven, top speed, stops. */}
          <div aria-label="Day totals" className="flex h-10 min-w-0 flex-1 items-center rounded-[10px] border border-hairline bg-surface">
            {[
              [t.miles, "mi"],
              [t.topMph != null ? t.topMph : "–", "mph top"],
              [t.stops, t.stops === 1 ? "stop" : "stops"],
            ].map(([v, l], i) => (
              <div
                key={l}
                className={`flex min-w-0 flex-1 items-baseline justify-center gap-1 ${i > 0 ? "border-l border-hairline" : ""}`}
              >
                <span className="text-sm font-bold tabular-nums">{v}</span>
                <span className="truncate text-xs text-muted">{l}</span>
              </div>
            ))}
          </div>
          {/* A fixed width (v0.794), so the row doesn't shift from day to day. */}
          <div className="flex h-10 w-[8.75rem] shrink-0 items-center rounded-[10px] border border-hairline bg-surface">
            <Link href={placesHref(embed, person.id, prev)} aria-label="Previous day" className="flex h-full w-8 shrink-0 items-center justify-center hover:bg-ground">
              ‹
            </Link>
            <span className="min-w-0 flex-1 truncate text-center text-[0.8rem] font-semibold">{dateLabel(day.date, today)}</span>
            {day.date < today ? (
              <Link href={placesHref(embed, person.id, next)} aria-label="Next day" className="flex h-full w-8 shrink-0 items-center justify-center hover:bg-ground">
                ›
              </Link>
            ) : (
              <span aria-hidden className="flex h-full w-8 shrink-0 items-center justify-center text-hairline">
                ›
              </span>
            )}
          </div>
        </div>
        </div>

        <aside
          aria-label="Timeline"
          className={`rounded-2xl border border-hairline bg-surface py-2 lg:h-full lg:w-96 lg:shrink-0 lg:overflow-y-auto ${
            embed ? "min-h-0 flex-1 overflow-y-auto" : ""
          }`}
        >
          {day.items.length === 0 && <p className="px-4 py-3 text-sm text-muted">Nothing recorded.</p>}
          {day.items.map((it, idx) => {
            if (it.kind === "stop") {
              const isSel = selected === it.n;
              return (
                <div key={`s${idx}`} className="flex items-center" style={isSel ? { backgroundColor: `${person.color}1f` } : undefined}>
                  <button type="button" onClick={() => focusStop(it)} className="flex min-w-0 flex-1 gap-3 py-3 pl-4 pr-2 text-left">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] bg-white font-mono text-xs font-semibold"
                      style={{ borderColor: person.color }}
                    >
                      {it.n}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{stopName(it)}</span>
                      {it.place?.name && it.place.address && (
                        <span className="block truncate text-sm text-muted">{it.place.address}</span>
                      )}
                      <span className="block font-mono text-xs text-muted">
                        {it.editId
                          ? `${time(it.start)} · added`
                          : it.lastSeen
                            ? `Last seen ${time(it.start)}`
                            : `${time(it.start)} – ${idx === day.items.length - 1 && day.date === today ? "now" : time(it.end)} · ${minutes(it.start, it.end)}`}
                      </span>
                    </span>
                  </button>
                  {isSel && canEdit && (
                    // On the right, like the people cards' icons (v0.794).
                    <div className="flex shrink-0 items-center gap-1.5 pr-3">
                      <button type="button" onClick={() => setFixing(it)} className={iconBtn} aria-label="Edit stop" title="Edit stop">
                        <PencilGlyph />
                      </button>
                      <button type="button" onClick={() => setRemoving(it)} className={iconBtn} aria-label="Remove stop" title="Remove stop">
                        <TrashGlyph />
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div
                key={`l${idx}`}
                className={`ml-[1.85rem] border-l-2 border-dashed pl-6 pt-1 text-sm text-muted ${canEdit ? "pb-0" : "pb-1"}`}
                style={{ borderColor: `${person.color}66` }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {it.motion === "drive" ? (
                    <CarIcon className="h-4 w-4" />
                  ) : it.motion === "workout" ? (
                    <DumbbellIcon className="h-4 w-4" />
                  ) : it.motion === "walk" ? (
                    <WalkIcon className="h-4 w-4" />
                  ) : (
                    <MotionIcon className="h-4 w-4" />
                  )}
                  {it.motion === "workout" ? (
                    <span className="font-medium text-ink">{it.activity}</span>
                  ) : (
                    <span className="sr-only">{it.motion === "drive" ? "Drive" : it.motion === "walk" ? "Walk" : "Moving"}</span>
                  )}
                  {it.motion === "workout" ? " · " : ""}
                  {minutes(it.start, it.end)} · {miles(it.distanceM)}
                  {it.topMph != null && it.motion !== "walk" ? ` · top ${it.topMph} mph` : ""}
                </span>
                {canEdit && (
                  // On the dashed line between the two stops: a small + and pin
                  // in the person's colour, softer until hovered or tapped; the
                  // page colour behind just the icon lets the dots run on.
                  <div className="relative h-6">
                    <button
                      type="button"
                      onClick={() => startAdding(it)}
                      className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center bg-surface py-0.5 opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 active:opacity-100"
                      style={{ left: "calc(-1.5rem - 1px)", color: person.color }}
                      aria-label="Add a stop here"
                      title="Add a stop here"
                    >
                      <svg viewBox="0 0 10 10" className="-mr-px h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                        <path d="M5 1.5v7M1.5 5h7" />
                      </svg>
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
                        <circle cx="12" cy="9.8" r="2.3" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {editError && <p className="px-4 py-2 text-sm text-red-700">{editError}</p>}
          {canEdit && (day.removed?.length ?? 0) > 0 && (
            <div className="mt-2 border-t border-hairline px-4 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Removed</h3>
              {day.removed!.map((r) => (
                <div key={r.editId} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {r.place?.name ?? r.place?.address ?? "A stop"} · {time(r.start)}
                  </span>
                  <button type="button" onClick={() => void change({ op: "undo", editId: r.editId })} className={small}>
                    Put back
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {removing && (
        // Removing asks first (v0.794). The trip in and out stays — it's joined
        // into one route through where the stop was; only the stop goes.
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setRemoving(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Remove stop"
            className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">Remove {stopName(removing)}?</h2>
            <p className="mt-2 text-sm text-muted">
              This deletes the stop but keeps the route. You can put it back from Removed at the bottom of the day.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRemoving(null)} className={small}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const it = removing;
                  setRemoving(null);
                  void change(it.editId ? { op: "undo", editId: it.editId } : { op: "remove", personId: person.id, start: it.start });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800"
              >
                <TrashGlyph />
                Remove stop
              </button>
            </div>
          </div>
        </div>
      )}
      {fixing && (
        <PlaceFix
          personId={person.id}
          personName={person.name}
          spot={{ lat: fixing.lat, lng: fixing.lng, accuracyM: 30 }}
          current={fixing.place?.name ?? fixing.place?.address ?? null}
          onClose={() => setFixing(null)}
          onSaved={() => router.refresh()}
        />
      )}
      {adding && (
        <AddStop
          personId={person.id}
          personName={person.name}
          middle={adding.middle}
          radiusM={adding.radiusM}
          mapKey={mapKey}
          mapId={mapId}
          color={person.color}
          onAdd={(n) =>
            change({ op: "add", personId: person.id, from: adding.from, to: adding.to, lat: n.lat, lng: n.lng, name: n.name, address: n.address })
          }
          onClose={() => setAdding(null)}
        />
      )}
    </main>
  );
}
