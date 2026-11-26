"use client";

import { useEffect, useRef, useState } from "react";
import { PLACE_TYPES, placeType, typeRadiusM } from "@/lib/places/visits-types";
import { importLibrary } from "@googlemaps/js-api-loader";
import { loadMaps } from "./map-kit";
import { mapLoaded, useEmbed } from "./embed-context";

/**
 * Pieces of the History page (v0.812): the place's close-up map with its
 * reach, the Place type drop-down, and the Filter sheet with its calendar.
 */

const fmtFt = (ft: number) => `${ft.toLocaleString()} ft`;

/**
 * A close-up of the place (v0.812.1): the pin stays in the middle and moving
 * the map moves the place (`onCenter`), with a blue circle as far as it
 * reaches. The zoom holds still so a bigger type shows a bigger circle; it
 * only backs out when the circle wouldn't fit. An unnamed spot gets its
 * nearest street address once the map is up (`onAddress`); nothing is stored.
 */
export function PlaceMap({
  mapKey,
  mapId,
  lat,
  lng,
  radiusM,
  onCenter,
  onAddress,
}: {
  mapKey: string;
  mapId: string;
  lat: number;
  lng: number;
  radiusM: number;
  onCenter?: (lat: number, lng: number) => void;
  onAddress?: (a: string) => void;
}) {
  const embed = useEmbed();
  const div = useRef<HTMLDivElement | null>(null);
  const circle = useRef<google.maps.Circle | null>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [here, setHere] = useState({ lat, lng });
  const cb = useRef({ onCenter, radiusM });
  cb.current = { onCenter, radiusM };

  /** Back out until the circle fits; never zooms in. */
  const fit = () => {
    const m = map.current;
    const c = circle.current;
    const view = m?.getBounds();
    const b = c?.getBounds();
    if (!m || !view || !b) return;
    if (!view.contains(b.getNorthEast()) || !view.contains(b.getSouthWest())) m.fitBounds(b, 16);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await mapLoaded(embed))) throw new Error("limit");
      await loadMaps(mapKey);
      if (cancelled || !div.current || map.current) return;
      const m = new google.maps.Map(div.current, {
        mapId,
        center: { lat, lng },
        zoom: 18,
        gestureHandling: "greedy",
        clickableIcons: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
        cameraControl: false,
      });
      map.current = m;
      circle.current = new google.maps.Circle({
        map: m,
        center: { lat, lng },
        radius: cb.current.radiusM,
        strokeColor: "#2563eb",
        strokeWeight: 2,
        fillColor: "#2563eb",
        fillOpacity: 0.12,
        clickable: false,
      });
      m.addListener("center_changed", () => {
        const c = m.getCenter();
        if (c) circle.current?.setCenter(c);
      });
      m.addListener("idle", () => {
        const c = m.getCenter();
        if (!c) return;
        setHere({ lat: c.lat(), lng: c.lng() });
        cb.current.onCenter?.(c.lat(), c.lng());
      });
      google.maps.event.addListenerOnce(m, "idle", fit);
      if (onAddress) {
        try {
          const { Geocoder } = await importLibrary("geocoding");
          const res = await new Geocoder().geocode({ location: { lat, lng } });
          const first = res.results.find((r) => r.types.includes("street_address") || r.types.includes("premise")) ?? res.results[0];
          if (!cancelled && first) onAddress(first.formatted_address.replace(/, USA$/, ""));
        } catch {
          // No address: the map still shows where it is.
        }
      }
    })().catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // The map is made once per place; the circle follows radiusM below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey, mapId, lat, lng]);

  useEffect(() => {
    if (!circle.current) return;
    circle.current.setRadius(radiusM);
    fit();
  }, [radiusM]);

  return (
    <div className="relative h-56 overflow-hidden rounded-2xl border border-hairline bg-ground">
      <div ref={div} className="h-full w-full" />
      {!failed && (
        <svg
          viewBox="0 0 24 34"
          className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-[1.6rem] -translate-x-1/2 -translate-y-full drop-shadow"
          aria-hidden
        >
          <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.5 12 34 12 34s12-13.5 12-22.3C24 5.2 18.6 0 12 0Z" fill="#dc2626" />
          <circle cx="12" cy="11.5" r="4.2" fill="#7f1d1d" />
        </svg>
      )}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${here.lat.toFixed(6)},${here.lng.toFixed(6)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold shadow"
      >
        Open in Google Maps &#8599;
      </a>
      {failed && <p className="absolute inset-0 flex items-center justify-center p-4 text-sm text-muted">The map couldn&rsquo;t load.</p>}
    </div>
  );
}

/**
 * Place type (v0.812.1): a row that opens the whole list on its own page,
 * names on the left and reach in feet on the right.
 */
export function PlaceTypeField({ value, onChange }: { value: string | null; onChange: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = placeType(value);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center gap-3 rounded-[10px] border border-hairline bg-surface px-3 text-left text-sm hover:border-accent"
      >
        <span className="shrink-0 font-medium">Place type</span>
        <span className={`min-w-0 flex-1 truncate text-right font-semibold ${cur ? "" : "text-muted"}`}>{cur?.label ?? "Choose one"}</span>
        {cur && <span className="tabular shrink-0 text-xs text-muted">{fmtFt(cur.ft)}</span>}
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {open && (
        <TypeList
          value={value}
          onPick={(k) => {
            onChange(k);
            setOpen(false);
          }}
          onBack={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TypeList({ value, onPick, onBack }: { value: string | null; onPick: (k: string) => void; onBack: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onBack]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 sm:items-center sm:p-3" onClick={onBack}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Place type"
        className="flex h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-2 py-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-ground"
          >
            &lsaquo;
          </button>
          <h2 className="text-base font-semibold">Place type</h2>
        </div>
        <ul role="listbox" aria-label="Place type" className="min-h-0 flex-1 overflow-y-auto">
          {PLACE_TYPES.map((t) => {
            const on = t.key === value;
            return (
              <li key={t.key} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => onPick(t.key)}
                  className="flex min-h-14 w-full items-center gap-3 border-b border-hairline px-4 text-left hover:bg-ground"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-accent" aria-hidden>
                    {on && (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5 9-10" />
                      </svg>
                    )}
                  </span>
                  <span className={`min-w-0 flex-1 text-[15px] ${on ? "font-semibold" : ""}`}>{t.label}</span>
                  <span className="tabular shrink-0 text-sm text-muted">{fmtFt(t.ft)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="shrink-0 px-4 py-3 text-xs text-muted">Feet from the pin to the edge of the circle.</p>
      </div>
    </div>
  );
}

/** A place type's reach in metres, else the place's own. */
export function reachM(type: string | null, fallback: number | null): number {
  return typeRadiusM(type) ?? fallback ?? 60;
}

export type When = "all" | "today" | "7" | "30" | "365" | "dates";
export type Filters = { who: string[]; when: When; from: string | null; to: string | null };
export const NO_FILTERS: Filters = { who: [], when: "all", from: null, to: null };

const WHENS: [When, string][] = [
  ["today", "Today"],
  ["7", "7 days"],
  ["30", "30 days"],
  ["365", "1 year"],
  ["all", "All"],
  ["dates", "Pick dates"],
];
export const whenLabel = (w: When) => WHENS.find(([k]) => k === w)?.[1] ?? "";

function shiftISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The first and last days a filter covers (null: no limit). */
export function rangeOf(f: Filters, today: string): { from: string | null; to: string | null } {
  if (f.when === "dates") return { from: f.from, to: f.to ?? f.from };
  if (f.when === "today") return { from: today, to: today };
  if (f.when === "all") return { from: null, to: null };
  return { from: shiftISO(today, -Number(f.when)), to: null };
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
}

const chip = (on: boolean) =>
  `inline-flex h-9 items-center whitespace-nowrap rounded-[10px] border px-3 text-sm font-semibold ${
    on ? "border-ink bg-ink text-white" : "border-hairline bg-surface text-ink hover:border-accent"
  }`;

/**
 * The Filter sheet: Who, When (quick ranges or two days picked on a
 * calendar), and a button with how many visits that leaves.
 */
export function FilterSheet({
  people,
  today,
  initial,
  countFor,
  onApply,
  onClose,
}: {
  people: { id: string; name: string }[];
  today: string;
  initial: Filters;
  countFor: (f: Filters) => Promise<number | null>;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<Filters>(initial);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    setCount(null);
    const t = setTimeout(() => void countFor(f).then((n) => live && setCount(n)), 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [f, countFor]);
  const toggle = (id: string) => setF((c) => ({ ...c, who: c.who.includes(id) ? c.who.filter((x) => x !== id) : [...c.who, id] }));
  const ready = f.when !== "dates" || f.from != null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter"
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-4">
          <h2 className="flex-1 text-base font-semibold">Filter</h2>
          <button type="button" onClick={() => setF(NO_FILTERS)} className="text-sm text-muted hover:text-ink">
            Clear all
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-3">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Who</h3>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={chip(f.who.length === 0)} onClick={() => setF((c) => ({ ...c, who: [] }))}>
                Everyone
              </button>
              {people.map((p) => (
                <button key={p.id} type="button" className={chip(f.who.includes(p.id))} onClick={() => toggle(p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">When</h3>
            <div className="flex flex-wrap gap-1.5">
              {WHENS.map(([k, l]) => (
                <button key={k} type="button" className={chip(f.when === k)} onClick={() => setF((c) => ({ ...c, when: k }))}>
                  {l}
                </button>
              ))}
            </div>
            {f.when === "dates" && (
              <RangeCalendar
                today={today}
                from={f.from}
                to={f.to}
                onChange={(from, to) => setF((c) => ({ ...c, from, to }))}
              />
            )}
          </section>
        </div>
        <div className="shrink-0 border-t border-hairline p-3">
          <button
            type="button"
            disabled={!ready}
            onClick={() => onApply(f)}
            className="flex h-11 w-full items-center justify-center rounded-[10px] bg-ink text-sm font-semibold text-white disabled:opacity-50"
          >
            {!ready ? "Pick a first day" : count == null ? "Show visits" : `Show ${count.toLocaleString()} visit${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A month to pick a range on: tap the first day, then the last. */
function RangeCalendar({
  today,
  from,
  to,
  onChange,
}: {
  today: string;
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}) {
  const start = (from ?? today).slice(0, 7);
  const [month, setMonth] = useState(start);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const iso = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const step = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const tap = (day: string) => {
    if (!from || (from && to)) onChange(day, null);
    else if (day < from) onChange(day, from);
    else onChange(from, day);
  };
  const end = to ?? from;
  return (
    <div className="mt-3 rounded-xl border border-hairline p-2.5">
      <div className="mb-1.5 flex items-center justify-between text-sm font-semibold">
        <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="h-8 w-8 rounded-full hover:bg-ground">
          &lsaquo;
        </button>
        <span>{first.toLocaleDateString([], { month: "long", year: "numeric", timeZone: "UTC" })}</span>
        <button type="button" onClick={() => step(1)} aria-label="Next month" className="h-8 w-8 rounded-full hover:bg-ground">
          &rsaquo;
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = iso(i + 1);
          const edge = d === from || d === end;
          const inside = from && end && d > from && d < end;
          const future = d > today;
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              onClick={() => tap(d)}
              className={`tabular h-9 text-sm disabled:text-muted/40 ${
                edge ? "rounded-full bg-ink font-semibold text-white" : inside ? "bg-ground" : "rounded-full hover:bg-ground"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-center text-xs text-muted">
        {from ? (to && to !== from ? `${shortDate(from)} – ${shortDate(to)}` : `${shortDate(from)} · tap the last day`) : "Tap the first day"}
      </p>
    </div>
  );
}
