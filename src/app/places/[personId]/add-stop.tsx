"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { PlaceChoice } from "@/lib/places/naming-types";
import { metres } from "@/lib/places/geo";
import { searchNow, useEmbed } from "../embed-context";
import { loadMaps } from "../map-kit";
import { PlaceFix, Shell, primary, row } from "../place-fix";
import { PinGlyph } from "../places-view";

/**
 * Add a stop the phone missed, between two stops (v0.771). Two ways:
 *   - Search: a business or address, looked up around the middle of the trip;
 *   - Drop a pin: move the map so the pin in the middle sits on the spot, then
 *     say what it was (nearby businesses, search, or just the stop).
 * Either way the stop goes on that trip at the time it passed nearest.
 */

type Spot = { lat: number; lng: number };
export type NewStop = { lat: number; lng: number; name: string | null; address: string | null };

function distance(m: number): string {
  const mi = m / 1609.344;
  if (mi < 0.1) return `${Math.max(10, Math.round((m * 3.28084) / 10) * 10)} ft`;
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

export function AddStop({
  personId,
  personName,
  middle,
  radiusM,
  mapKey,
  mapId,
  color,
  onAdd,
  onClose,
}: {
  personId: string;
  personName: string;
  /** The middle of the trip the stop goes on. */
  middle: Spot;
  /** How far around the middle to search. */
  radiusM: number;
  mapKey: string;
  mapId: string;
  color: string;
  onAdd: (s: NewStop) => Promise<string | null>;
  onClose: () => void;
}) {
  const embed = useEmbed();
  const [mode, setMode] = useState<"search" | "pin">("search");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PlaceChoice[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Spot | null>(null);
  const [pending, start] = useTransition();

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setError(null);
    try {
      const res = await searchNow(embed, { ...middle, accuracyM: null }, q, radiusM);
      setFound(
        res.choices
          .map((c) => ({ ...c, distanceM: c.lat != null && c.lng != null ? metres(middle, { lat: c.lat, lng: c.lng }) : null }))
          .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0)),
      );
      setError(res.error);
    } catch {
      setError("Couldn't search. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const add = (s: NewStop) =>
    start(async () => {
      setError(null);
      const err = await onAdd(s);
      if (err) setError(err);
      else onClose();
    });

  if (pinned) {
    return (
      <PlaceFix
        personId={personId}
        personName={personName}
        spot={{ ...pinned, accuracyM: 30 }}
        onPick={(c) => onAdd({ ...pinned, name: c?.name ?? null, address: c?.address ?? null })}
        onClose={onClose}
        onSaved={() => undefined}
      />
    );
  }

  return (
    <Shell title={`Add a stop for ${personName}`} onClose={onClose} full>
      <div className="inline-flex rounded-full border border-hairline bg-surface p-1" role="tablist">
        {(
          [
            ["search", "Search"],
            ["pin", "Drop a pin"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`h-9 rounded-full px-4 text-sm font-medium ${mode === m ? "bg-accent text-on-accent" : "text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "search" ? (
        <>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={120}
              autoFocus
              enterKeyHint="search"
              placeholder="Business, place or address"
              aria-label="Business, place or address"
              className="h-11 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 text-base outline-none focus:border-accent"
            />
            <button type="submit" disabled={!query.trim() || searching} className={primary}>
              {searching ? "…" : "Search"}
            </button>
          </form>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="space-y-2">
            {found?.map((c) => (
              <button
                key={`${c.placeId ?? c.name}|${c.address}`}
                type="button"
                disabled={pending || c.lat == null || c.lng == null}
                onClick={() => c.lat != null && c.lng != null && add({ lat: c.lat, lng: c.lng, name: c.name, address: c.address })}
                className={row}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  {c.address && <span className="block truncate text-xs text-muted">{c.address}</span>}
                </span>
                {c.distanceM != null && <span className="shrink-0 pl-3 font-mono text-xs text-muted">{distance(c.distanceM)}</span>}
              </button>
            ))}
            {found && found.length === 0 && <p className="py-1 text-sm text-muted">Nothing found along this trip.</p>}
          </div>
        </>
      ) : (
        <PinPicker mapKey={mapKey} mapId={mapId} start={middle} color={color} onPick={setPinned} />
      )}
    </Shell>
  );
}

/** A map with a pin fixed in the middle: move the map under it. */
function PinPicker({
  mapKey,
  mapId,
  start,
  color,
  onPick,
}: {
  mapKey: string;
  mapId: string;
  start: Spot;
  color: string;
  onPick: (s: Spot) => void;
}) {
  const div = useRef<HTMLDivElement | null>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMaps(mapKey)
      .then(() => {
        if (cancelled || !div.current || map.current) return;
        map.current = new google.maps.Map(div.current, {
          mapId,
          center: start,
          zoom: 17,
          gestureHandling: "greedy",
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [mapKey, mapId, start]);

  return (
    <div className="space-y-3">
      <div className="relative h-[55vh] min-h-[320px] overflow-hidden rounded-2xl border border-hairline bg-surface">
        <div ref={div} className="h-full w-full" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full" style={{ color }}>
          <svg viewBox="0 0 24 24" className="h-10 w-10 drop-shadow" aria-hidden>
            <path d="M12 22s-7-6.6-7-12a7 7 0 0 1 14 0c0 5.4-7 12-7 12Z" fill="currentColor" stroke="#fff" strokeWidth="1.5" />
            <circle cx="12" cy="10" r="2.6" fill="#fff" />
          </svg>
        </div>
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-sm text-red-700">The map couldn&rsquo;t load.</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          const c = map.current?.getCenter();
          if (c) onPick({ lat: c.lat(), lng: c.lng() });
        }}
        className={`${primary} gap-2`}
      >
        <PinGlyph />
        Use this spot
      </button>
    </div>
  );
}
