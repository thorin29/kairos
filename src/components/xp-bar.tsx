"use client";

import { STAT_ORDER, type StatKey } from "@/lib/scoring/progression";

// Domain colours (match the companion palette hues).
const HEX: Record<StatKey, string> = {
  CHORE: "#22c55e",
  EXERCISE: "#f97316",
  BIBLE: "#eab308",
  SCHOOL: "#6366f1",
  TASK: "#14b8a6",
};

const CELLS = 20;

/**
 * A tight row of little squares showing progress into the current level. The
 * filled squares are coloured by what you actually did — grouped by domain into
 * bands (all chore-green together, all workout-orange together, …) so it reads
 * as your mix at a glance, not confetti. Replaces the old "evolves in N" text.
 */
export function XpBar({
  pct,
  shares,
}: {
  pct: number;
  shares: Record<StatKey, number>;
}) {
  const filled = Math.max(0, Math.min(CELLS, Math.round((pct / 100) * CELLS)));

  // Allocate the filled cells across domains by share, in a fixed order so
  // colours stay grouped. Largest-remainder keeps the total exact.
  const raw = STAT_ORDER.map((k) => ({ k, want: (shares[k] ?? 0) * filled }));
  const alloc: Record<StatKey, number> = {
    CHORE: 0,
    EXERCISE: 0,
    BIBLE: 0,
    SCHOOL: 0,
    TASK: 0,
  };
  let used = 0;
  for (const r of raw) {
    alloc[r.k] = Math.floor(r.want);
    used += alloc[r.k];
  }
  let remainder = filled - used;
  for (const r of raw.slice().sort((a, b) => (b.want % 1) - (a.want % 1))) {
    if (remainder <= 0) break;
    alloc[r.k] += 1;
    remainder -= 1;
  }

  const cells: (string | null)[] = [];
  for (const k of STAT_ORDER) for (let i = 0; i < alloc[k]; i++) cells.push(HEX[k]);
  // if nothing has a domain share yet but there's fill, show neutral fill
  while (cells.length < filled) cells.push("#94a3b8");
  while (cells.length < CELLS) cells.push(null);

  return (
    <div className="flex gap-[2px]" aria-label={`${pct}% into this level`}>
      {cells.map((c, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-[2px]"
          style={{ background: c ?? "var(--color-hairline)", opacity: c ? 1 : 0.5 }}
        />
      ))}
    </div>
  );
}
