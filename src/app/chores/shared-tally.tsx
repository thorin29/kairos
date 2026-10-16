"use client";

import { useEffect, useState } from "react";
import { formatShort } from "@/lib/dates";
import type { SharedTallyRow } from "@/lib/queries/chores-summary";

/**
 * The per-person shared-chore counts. Each name is a button that opens a
 * centered pop-up listing exactly the completions behind that number — the
 * chore and the day it was done, newest first.
 *
 * Centered over a dimmed page (the same overlay as Add event) rather than
 * dropped down from the chip: a drop-down ran off the bottom of the window
 * and became unreadable. The list scrolls inside the pop-up, which is capped
 * at 70% of the screen height. Closes on ✕, the backdrop, or Escape.
 */
export function SharedTally({ rows }: { rows: SharedTallyRow[] }) {
  const [open, setOpen] = useState<SharedTallyRow | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {rows.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => setOpen(t)}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-xs transition-colors hover:border-accent"
          >
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: t.color }} />
            {t.name}
            <span className="tabular font-semibold">{t.count}</span>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${open.name}'s shared chores`}
            className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: open.color }} />
              <h2 className="flex-1 font-display text-lg font-semibold">
                {open.name} <span className="tabular text-muted">&middot; {open.count}</span>
              </h2>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground"
              >
                ✕
              </button>
            </div>
            <ul className="-mx-1 min-h-0 flex-1 divide-y divide-hairline overflow-y-auto px-1">
              {open.items.map((it, i) => (
                <li key={i} className="flex items-baseline gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{it.title}</span>
                  <span className="tabular shrink-0 text-muted">{formatShort(it.dateISO)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
