"use client";

import { useEffect, useState, useTransition } from "react";
import { namePlace, placeChoices } from "@/lib/actions/places-live";

/**
 * "Not right?" for a person's place (live card or a History stop). A short
 * choice pop-up: another nearby business Google already returned, "Just the
 * address", or "Name this place…" — which opens a full page (filling in is a
 * full page, per the UI rule). Whatever is chosen is saved as the family's own
 * name for the spot and always wins from then on.
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
  onClose,
  onSaved,
}: {
  personId: string;
  personName: string;
  spot: Spot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<"choose" | "name">("choose");
  const [choices, setChoices] = useState<{ name: string; address: string | null }[] | null>(null);
  const [name, setName] = useState("");
  const [forOne, setForOne] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    placeChoices(spot.lat, spot.lng, spot.accuracyM)
      .then((c) => alive && setChoices(c))
      .catch(() => alive && setChoices([]));
    return () => {
      alive = false;
    };
  }, [spot.lat, spot.lng, spot.accuracyM]);

  const save = (value: string | null, mine: boolean) =>
    start(async () => {
      setError(null);
      const res = await namePlace({ lat: spot.lat, lng: spot.lng, name: value, forUserId: mine ? personId : null });
      if (res.error) setError(res.error);
      else {
        onSaved();
        onClose();
      }
    });

  if (step === "name") {
    return (
      <Shell title="Name this place" onClose={onClose} onBack={() => setStep("choose")} full>
        <div className="space-y-4 rounded-xl border border-hairline bg-surface px-4 py-4">
          <div>
            <label htmlFor="place-name" className="mb-1 block text-sm font-medium">
              Name
            </label>
            <input
              id="place-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
              placeholder="Work, Dentist, Grandma's"
              className="h-11 w-full rounded-lg border border-hairline bg-surface px-3 text-base outline-none focus:border-accent"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Who sees this name</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="radio" name="who" checked={!forOne} onChange={() => setForOne(false)} className="h-4 w-4" />
              Everyone
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="radio" name="who" checked={forOne} onChange={() => setForOne(true)} className="h-4 w-4" />
              Just {personName}
            </label>
          </fieldset>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="button" disabled={pending || !name.trim()} onClick={() => save(name, forOne)} className={primary}>
            Save
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={`Where is ${personName}?`} onClose={onClose}>
      {choices == null ? (
        <p className="py-2 text-sm text-muted">Looking nearby…</p>
      ) : (
        choices.map((c) => (
          <button key={`${c.name}|${c.address}`} type="button" disabled={pending} onClick={() => save(c.name, false)} className={row}>
            <span className="min-w-0">
              <span className="block truncate font-medium">{c.name}</span>
              {c.address && <span className="block truncate text-xs text-muted">{c.address}</span>}
            </span>
          </button>
        ))
      )}
      <button type="button" disabled={pending} onClick={() => save(null, false)} className={row}>
        Just the address
      </button>
      <button type="button" disabled={pending} onClick={() => setStep("name")} className={row}>
        Name this place…
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </Shell>
  );
}
