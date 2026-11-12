"use client";

import { useTransition } from "react";
import { BandageIcon } from "@/components/icons";
import { setSoreSpot } from "@/lib/actions/workouts";
import { SORE_LABEL, SORE_PATHS, type SoreArea, type SoreSpot } from "@/lib/workouts/sore";

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
 * Sore spots under the body map (v0.675; v0.677 marked only from a workout's
 * band-aid, "Something hurt?"): each one with Better. A spot stays until
 * Better, never on its own. Nothing shows when nothing hurts.
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
  const [pending, start] = useTransition();
  const better = (area: SoreArea) =>
    start(async () => {
      try {
        onChange(await setSoreSpot(userId, area, false));
      } catch {
        /* stays as it was */
      }
    });
  if (spots.length === 0) return null;
  return (
    <div className="space-y-2">
      {spots.map((s) => (
        <div key={s.area} className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/30">
          <BandageIcon className="h-[18px] w-[18px] shrink-0 text-red-700 dark:text-red-300" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">{SORE_LABEL[s.area]}</span>
            <span className="truncate text-xs text-muted">
              Since {dayText(s.since)}
              {s.from ? ` · from ${s.from}` : ""}
            </span>
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => better(s.area)}
            className="inline-flex h-9 shrink-0 items-center rounded-full border border-hairline bg-surface px-3.5 text-sm font-semibold hover:border-accent disabled:opacity-50"
          >
            Better
          </button>
        </div>
      ))}
    </div>
  );
}
