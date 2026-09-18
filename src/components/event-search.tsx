"use client";

import { useEffect, useRef, useState } from "react";
import { searchEvents, type EventSearchResult } from "@/lib/actions/event-search";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const mer = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${mer}`;
}

function fmtDate(iso: string) {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return {
    year: String(y),
    day: String(d),
    weekday: WEEKDAYS[dt.getUTCDay()],
    month: MONTHS[mo - 1],
  };
}

function SearchGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function EventSearch({ chip }: { chip: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<EventSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchEvents(query).catch(() => ({ results: [] }));
      setResults(res.results);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setQ("");
    setResults([]);
  }

  const groups: { year: string; items: EventSearchResult[] }[] = [];
  for (const r of results) {
    const year = r.dateISO.slice(0, 4);
    let g = groups.find((x) => x.year === year);
    if (!g) {
      g = { year, items: [] };
      groups.push(g);
    }
    g.items.push(r);
  }

  const query = q.trim();

  return (
    <>
      <button
        type="button"
        aria-label="Search events"
        onClick={() => setOpen(true)}
        className={`${chip} px-2.5`}
      >
        <SearchGlyph />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ground">
          <div className="flex items-center gap-2 border-b border-hairline bg-surface px-4 py-3">
            <SearchGlyph className="h-5 w-5 shrink-0 text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events"
              className="h-9 w-full bg-transparent text-base outline-none"
            />
            {q && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setQ("")}
                className="text-sm text-muted hover:text-ink"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="rounded-full px-3 py-1 text-sm font-medium text-muted hover:text-ink"
            >
              Close
            </button>
          </div>

          <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-5">
            {query.length < 2 ? (
              <p className="mt-8 text-center text-sm text-muted">
                Type at least 2 letters to search your events.
              </p>
            ) : loading ? (
              <p className="mt-8 text-center text-sm text-muted">Searching…</p>
            ) : results.length === 0 ? (
              <p className="mt-8 text-center text-sm text-muted">
                No events match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <div className="space-y-6">
                {groups.map((g) => (
                  <div key={g.year}>
                    <h3 className="mb-2 text-sm font-semibold text-muted">
                      {g.year}
                    </h3>
                    <div className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface">
                      {g.items.map((r) => {
                        const d = fmtDate(r.dateISO);
                        return (
                          <div
                            key={r.id}
                            className="flex items-center gap-4 px-4 py-3"
                          >
                            <div className="w-12 shrink-0 text-center">
                              <div className="text-xs text-muted">{d.weekday}</div>
                              <div className="text-lg font-semibold leading-none">
                                {d.day}
                              </div>
                              <div className="text-xs text-muted">{d.month}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{r.title}</div>
                              <div className="truncate text-xs text-muted">
                                {r.startMin === null
                                  ? "All day"
                                  : `${fmtTime(r.startMin)}${
                                      r.endMin !== null ? ` – ${fmtTime(r.endMin)}` : ""
                                    }`}
                                {r.repeats ? " · repeats" : ""}
                                {r.ownerName ? ` · ${r.ownerName}` : ""}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
