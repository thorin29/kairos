"use client";

import { useEffect, useState, useTransition } from "react";
import type { PlaceChoice } from "@/lib/places/naming-types";
import { choicesNow, saveNameNow, searchNow, useEmbed } from "./embed-context";

/**
 * "Not right?" for a person's place (live card or a History stop), v0.768: a
 * full page to say what the place really is. Nearby businesses Google already
 * returned come first; type anything ("Lowe's", "the rink", an address) to
 * look it up near the spot, or save what's typed as the name ("Grandma's").
 * The choice is the family's name for that spot from then on — everyone's, or
 * just this person's — and History re-labels with it.
 */

type Spot = { lat: number; lng: number; accuracyM: number | null };

const row =
  "flex min-h-11 w-full items-center rounded-xl border border-hairline bg-surface px-3 py-2 text-left text-sm hover:border-accent disabled:opacity-50";
const primary =
  "inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent shadow-sm hover:brightness-110 disabled:opacity-50";

function Shell({
  title,
  onClose,
  onBack,
  full,
  children,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  full?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") (onBack ?? onClose)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onClose]);

  if (!full) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          role="dialog"
          aria-label={title}
          className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-surface shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
            <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h3>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 overflow-y-auto px-4 py-4">{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[80] flex flex-col bg-ground">
      <div className="border-b border-hairline bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-2 py-2 sm:px-4">
          <button
            type="button"
            aria-label="Back"
            onClick={onBack ?? onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-ink hover:bg-ground"
          >
            ‹
          </button>
          <h3 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{title}</h3>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 pb-10">{children}</div>
      </div>
    </div>
  );
}

export function PlaceFix({
  personId,
  personName,
  spot,
  current,
  onClose,
  onSaved,
}: {
  personId: string;
  personName: string;
  spot: Spot;
  /** What the spot is called now. */
  current?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const embed = useEmbed();
  const [nearby, setNearby] = useState<PlaceChoice[] | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PlaceChoice[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [forOne, setForOne] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const { lat, lng, accuracyM } = spot;
  useEffect(() => {
    let alive = true;
    choicesNow(embed, { lat, lng, accuracyM })
      .then((c) => alive && setNearby(c))
      .catch(() => alive && setNearby([]));
    return () => {
      alive = false;
    };
  }, [embed, lat, lng, accuracyM]);

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setError(null);
    try {
      const res = await searchNow(embed, spot, q);
      setFound(res.choices);
      setError(res.error);
    } catch {
      setError("Couldn't search. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const save = (c: { name: string; address: string | null; placeId: string | null; lat: number | null; lng: number | null }) =>
    start(async () => {
      setError(null);
      const res = await saveNameNow(embed, {
        lat: spot.lat,
        lng: spot.lng,
        name: c.name,
        address: c.address,
        placeId: c.placeId,
        placeLat: c.lat,
        placeLng: c.lng,
        forUserId: forOne ? personId : null,
      });
      if (res.error) setError(res.error);
      else {
        onSaved();
        onClose();
      }
    });

  const typed = query.trim();
  const list = found ?? nearby;

  return (
    <Shell title={`Where was ${personName}?`} onClose={onClose} full>
      {current && (
        <p className="text-sm text-muted">
          Showing <span className="font-medium text-ink">{current}</span>
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) setFound(null);
          }}
          maxLength={120}
          autoFocus
          enterKeyHint="search"
          placeholder="Business, place or address"
          aria-label="Business, place or address"
          className="h-11 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 text-base outline-none focus:border-accent"
        />
        <button type="submit" disabled={!typed || searching} className={primary}>
          {searching ? "…" : "Search"}
        </button>
      </form>

      <fieldset className="flex flex-wrap gap-x-5">
        <legend className="sr-only">Who sees this name</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="who" checked={!forOne} onChange={() => setForOne(false)} className="h-4 w-4" />
          For everyone
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="who" checked={forOne} onChange={() => setForOne(true)} className="h-4 w-4" />
          Just {personName}
        </label>
      </fieldset>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {list == null ? (
          <p className="py-2 text-sm text-muted">Looking nearby…</p>
        ) : (
          <>
            {list.length > 0 && (
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted">{found ? "Found" : "Nearby"}</h4>
            )}
            {list.map((c) => (
              <button
                key={`${c.placeId ?? c.name}|${c.address}`}
                type="button"
                disabled={pending}
                onClick={() => save(c)}
                className={row}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  {c.address && <span className="block truncate text-xs text-muted">{c.address}</span>}
                </span>
                {c.distanceM != null && <span className="shrink-0 pl-3 font-mono text-xs text-muted">{distance(c.distanceM)}</span>}
              </button>
            ))}
            {found && found.length === 0 && <p className="py-1 text-sm text-muted">Nothing found near here.</p>}
          </>
        )}
        {typed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => save({ name: typed, address: null, placeId: null, lat: null, lng: null })}
            className={row}
          >
            <span className="min-w-0 flex-1 truncate">
              Call it <span className="font-medium">“{typed}”</span>
            </span>
          </button>
        )}
      </div>
    </Shell>
  );
}

/** Feet under a tenth of a mile, then miles. */
function distance(m: number): string {
  const mi = m / 1609.344;
  if (mi < 0.1) return `${Math.max(10, Math.round((m * 3.28084) / 10) * 10)} ft`;
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}
