"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CarIcon, MapIcon, MotionIcon, WalkIcon } from "@/components/icons";
import { changeStopNow, mapLoaded, placesHref, useEmbed, type StopChange } from "../embed-context";
import type { DayData, DayItem, DayLegItem, DayStopItem } from "@/lib/places/history-types";
import { drawTrips, loadMaps, touchInline } from "../map-kit";
import { PlaceFix } from "../place-fix";
import { AddStop } from "./add-stop";
import { metres } from "@/lib/places/geo";
import { PencilGlyph, PinGlyph, TrashGlyph } from "../places-view";

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
const statCard = "rounded-xl border border-hairline bg-surface px-4 py-3";
const statLabel = "text-xs font-semibold uppercase tracking-widest text-muted";

const SPEEDS = [30, 120, 480] as const;
/** Time a stop takes during replay, in replay milliseconds. */
const STOP_PAUSE_MS = 600;

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
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
  const [fixing, setFixing] = useState<DayStopItem | null>(null);
  /** Adding a stop on a trip: its times, middle and search reach. */
  const [adding, setAdding] = useState<{ from: string; to: string; middle: { lat: number; lng: number }; radiusM: number } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(SPEEDS[1]);
  const [replayAt, setReplayAt] = useState<number | null>(null);

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const lines = useRef<google.maps.Polyline[]>([]);
  const pins = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const ghost = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const vRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const stops = useMemo(() => day.items.filter((i): i is DayStopItem => i.kind === "stop"), [day]);
  const frames = useMemo(() => buildFrames(day.items), [day]);
  const hasTrips = frames.length >= 2;

  useEffect(() => {
    let cancelled = false;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () =>
      setMapError("Google refused the map key. Check the key and its website restriction in Admin → Family map.");
    loadMaps(mapKey)
      .then(() => {
        if (cancelled || !mapDiv.current || mapRef.current) return;
        mapRef.current = new google.maps.Map(mapDiv.current, {
          mapId,
          center: { lat: 39.5, lng: -98.35 },
          zoom: 4,
          gestureHandling: touchInline() ? "cooperative" : "greedy",
          clickableIcons: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });
        setReady(true);
        void mapLoaded(embed).catch(() => undefined);
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
      pin.addEventListener("gmp-click", () => setSelected(s.n));
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
      map.fitBounds(b, 56);
      if (stops.length === 1 && !hasTrips) map.setZoom(15);
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

  // A new day resets replay.
  useEffect(() => {
    setPlaying(false);
    setReplayAt(null);
    setSelected(null);
    vRef.current = 0;
    if (ghost.current) ghost.current.map = null;
  }, [day.date]);

  const focusStop = (s: DayStopItem) => {
    setSelected(s.n);
    mapRef.current?.panTo({ lat: s.lat, lng: s.lng });
    if ((mapRef.current?.getZoom() ?? 0) < 15) mapRef.current?.setZoom(16);
  };

  const prev = shiftDate(day.date, -1);
  const next = shiftDate(day.date, 1);
  const t = day.totals;

  return (
    <main className={embed ? "px-3 py-3" : "mx-auto max-w-[96rem] px-4 py-6 sm:px-6"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={placesHref(embed)}
            aria-label="Back to Family map"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-surface text-xl hover:border-accent"
          >
            ‹
          </Link>
          <Avatar name={person.name} color={person.color} avatarPath={person.avatarPath} avatarPosition={person.avatarPosition} size="md" />
          <h1 className="font-display text-3xl font-semibold tracking-tight">{person.name}</h1>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface p-1">
          <Link href={placesHref(embed, person.id, prev)} aria-label="Previous day" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ground">
            ‹
          </Link>
          <span className="min-w-28 px-2 text-center text-sm font-semibold">{dateLabel(day.date, today)}</span>
          {day.date < today ? (
            <Link href={placesHref(embed, person.id, next)} aria-label="Next day" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ground">
              ›
            </Link>
          ) : (
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full text-hairline">
              ›
            </span>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={statCard}>
          <div className={statLabel}>Distance</div>
          <div className="mt-1 font-mono text-xl">{t.miles} mi</div>
        </div>
        <div className={statCard}>
          <div className={statLabel}>Driving</div>
          <div className="mt-1 font-mono text-xl">
            {t.driveMin < 60 ? `${t.driveMin} min` : `${Math.floor(t.driveMin / 60)} h ${t.driveMin % 60} min`}
          </div>
        </div>
        <div className={statCard}>
          <div className={statLabel}>Top speed</div>
          <div className="mt-1 font-mono text-xl">{t.topMph != null ? `${t.topMph} mph` : "—"}</div>
        </div>
        <div className={statCard}>
          <div className={statLabel}>Stops</div>
          <div className="mt-1 font-mono text-xl">{t.stops}</div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section
          aria-label="Map"
          className="relative h-[52vh] min-h-[340px] overflow-hidden rounded-2xl border border-hairline bg-surface lg:h-[calc(100dvh-14rem)] lg:min-w-0 lg:flex-1"
        >
          <div ref={mapDiv} className="h-full w-full" />
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

        <aside aria-label="Timeline" className="rounded-2xl border border-hairline bg-surface py-2 lg:w-96 lg:shrink-0">
          {day.items.length === 0 && <p className="px-4 py-3 text-sm text-muted">Nothing recorded.</p>}
          {day.items.map((it, idx) => {
            if (it.kind === "stop") {
              const isSel = selected === it.n;
              return (
                <div key={`s${idx}`} style={isSel ? { backgroundColor: `${person.color}1f` } : undefined}>
                  <button type="button" onClick={() => focusStop(it)} className="flex w-full gap-3 px-4 py-3 text-left">
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
                          : `${time(it.start)} – ${idx === day.items.length - 1 && day.date === today ? "now" : time(it.end)} · ${minutes(it.start, it.end)}`}
                      </span>
                    </span>
                  </button>
                  {isSel && canEdit && (
                    <div className="flex flex-wrap gap-2 px-4 pb-3 pl-14">
                      <button type="button" onClick={() => setFixing(it)} className={small}>
                        <PencilGlyph />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(`Remove ${stopName(it)} from ${person.name}'s day?`)) return;
                          void change(it.editId ? { op: "undo", editId: it.editId } : { op: "remove", personId: person.id, start: it.start });
                        }}
                        className={small}
                      >
                        <TrashGlyph />
                        Remove
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
                  ) : it.motion === "walk" ? (
                    <WalkIcon className="h-4 w-4" />
                  ) : (
                    <MotionIcon className="h-4 w-4" />
                  )}
                  <span className="sr-only">{it.motion === "drive" ? "Drive" : it.motion === "walk" ? "Walk" : "Moving"}</span>
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
