"use client";

import { useState, useTransition } from "react";
import { Modal } from "./plan-file-panel";
import { setSoreSpot } from "@/lib/actions/workouts";
import { SORE_AREAS, SORE_LABEL, SORE_PATHS, type SoreArea, type SoreSpot } from "@/lib/workouts/sore";

/** Every sore spot's regions on the two figures. */
export function soreRegions(spots: readonly SoreSpot[]): { front: number[]; back: number[] } {
  const front = new Set<number>();
  const back = new Set<number>();
  for (const s of spots) {
    for (const i of SORE_PATHS[s.area].front) front.add(i);
    for (const i of SORE_PATHS[s.area].back) back.add(i);
  }
  return { front: [...front], back: [...back] };
}

const dayText = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Sore spots under the body map (v0.675): each marked area with Better, and a
 * button to mark one. A spot stays until Better — never on its own.
 */
export function SoreSpots({
  userId,
  spots,
  onChange,
}: {
  userId: string;
  spots: SoreSpot[];
  onChange: (spots: SoreSpot[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<SoreArea | null>(null);
  const [pending, start] = useTransition();
  const free = SORE_AREAS.filter((a) => !spots.some((s) => s.area === a));
  const save = (area: SoreArea, sore: boolean) =>
    start(async () => {
      try {
        onChange(await setSoreSpot(userId, area, sore));
      } catch {
        /* stays as it was */
      }
    });
  return (
    <div className="space-y-2">
      {spots.map((s) => (
        <div key={s.area} className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/30">
          <span
            className="h-3 w-3 shrink-0 rounded-[3px]"
            style={{ background: "repeating-linear-gradient(45deg, #c0392b 0 3px, #f6c9c6 3px 6px)" }}
            aria-hidden
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">{SORE_LABEL[s.area]} sore</span>
            <span className="truncate text-xs text-muted">
              Since {dayText(s.since)}
              {s.from ? ` · from ${s.from}` : ""}
            </span>
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(s.area, false)}
            className="inline-flex h-9 shrink-0 items-center rounded-full border border-hairline bg-surface px-3.5 text-sm font-semibold hover:border-accent disabled:opacity-50"
          >
            Better
          </button>
        </div>
      ))}
      {free.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setPick(null);
            setOpen(true);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-300 px-3 text-sm font-semibold text-red-800 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          <span aria-hidden>+</span> Sore spot
        </button>
      )}
      {open && (
        <Modal title="Sore spot" onClose={() => setOpen(false)}>
          <p className="font-semibold">Where?</p>
          <div className="flex flex-wrap gap-2">
            {free.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={pick === a}
                onClick={() => setPick(a)}
                className={`inline-flex h-10 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                  pick === a ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
                }`}
              >
                {SORE_LABEL[a]}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 items-center rounded-full border border-hairline px-4 text-sm font-semibold">
              Cancel
            </button>
            <button
              type="button"
              disabled={!pick || pending}
              onClick={() => {
                if (!pick) return;
                save(pick, true);
                setOpen(false);
              }}
              className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50"
            >
              Mark sore
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
