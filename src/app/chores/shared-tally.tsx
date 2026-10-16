"use client";

import { useEffect, useRef, useState } from "react";
import { formatShort } from "@/lib/dates";
import type { SharedTallyRow } from "@/lib/queries/chores-summary";

const PANEL_W = 256;

/**
 * The per-person shared-chore counts. Each name is a button: it opens a small
 * panel listing exactly the completions behind that number — the chore and the
 * day it was done, newest first. Closes on a second click, outside, or Escape.
 */
export function SharedTally({ rows }: { rows: SharedTallyRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  // Where the panel sits relative to its chip: under it, but slid left as far
  // as needed to stay 16px inside the screen (a chip mid-row on a phone has
  // room on neither side for a left- or right-anchored panel).
  const [shift, setShift] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="mb-3 flex flex-wrap gap-2">
      {rows.map((t) => {
        const isOpen = open === t.name;
        return (
          <div key={t.name} className="relative">
            <button
              type="button"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const width = Math.min(PANEL_W, window.innerWidth - 32);
                const left = Math.max(16, Math.min(r.left, window.innerWidth - 16 - width));
                setShift(left - r.left);
                setOpen(isOpen ? null : t.name);
              }}
              aria-expanded={isOpen}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                isOpen ? "border-accent bg-accent/10" : "border-hairline hover:border-accent"
              }`}
            >
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              {t.name}
              <span className="tabular font-semibold">{t.count}</span>
            </button>
            {isOpen && (
              <div
                className="absolute top-full z-30 mt-1.5 max-w-[calc(100vw-2rem)] rounded-xl border border-hairline bg-surface p-3 shadow-lg"
                style={{ left: shift, width: PANEL_W }}
              >
                <p className="mb-2 text-xs font-semibold">
                  {t.name} &middot; {t.count}
                </p>
                <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {t.items.map((it, i) => (
                    <li key={i} className="flex items-baseline gap-3 text-xs">
                      <span className="min-w-0 flex-1 truncate">{it.title}</span>
                      <span className="tabular shrink-0 text-muted">{formatShort(it.dateISO)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
