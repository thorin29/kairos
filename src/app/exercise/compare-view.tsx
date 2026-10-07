"use client";

import { useState } from "react";
import type { MovementComparison } from "@/lib/queries/workouts";

/**
 * One movement, one bar per person.
 *
 * This used to be a dot plot of everyone's sessions over time, which answered a
 * question nobody was asking here: the interesting comparison between people is
 * their best, not the shape of their history. A bar each, aligned on one scale,
 * reads at a glance.
 *
 * Each bar carries the other number above it — the reps at that weight, or the
 * weight at those reps. A bar on its own is one number, and one number is not
 * enough to know whether 175 for 2 beats 155 for 8.
 */
type Mode = "weight" | "reps";

export function CompareView({ movements }: { movements: MovementComparison[] }) {
  const weightMovements = movements.filter((m) => m.metric === "WEIGHT");
  const [id, setId] = useState(weightMovements[0]?.poolExerciseId ?? "");
  const [mode, setMode] = useState<Mode>("weight");
  const current =
    weightMovements.find((m) => m.poolExerciseId === id) ?? weightMovements[0];
  if (!current) return null;

  const bars = current.series
    .map((s) => {
      const best = mode === "weight" ? s.bestWeight : s.bestReps;
      if (!best) return null;
      const value = mode === "weight" ? best.value : (best as { reps: number }).reps;
      const over =
        mode === "weight"
          ? (best as { reps: number | null }).reps
          : (best as { value: number }).value;
      return { id: s.id, name: s.name, color: s.color, value, over };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null && b.value > 0);

  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Compare</h2>
        <select
          value={current.poolExerciseId}
          onChange={(e) => setId(e.target.value)}
          className="h-9 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
        >
          {weightMovements.map((m) => (
            <option key={m.poolExerciseId} value={m.poolExerciseId}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex gap-2">
        {(["weight", "reps"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === m
                ? "border-accent bg-accent text-on-accent"
                : "border-hairline text-muted hover:text-ink"
            }`}
          >
            {m === "weight" ? "Heaviest weight" : "Most reps"}
          </button>
        ))}
      </div>

      {bars.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing logged for this movement yet.
        </p>
      ) : (
        <div className="flex items-end justify-around gap-3" style={{ height: 220 }}>
          {bars.map((b) => (
            <div
              key={b.id}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              {/* The other number, above the bar: a bar is one value and that
                  is not enough to know whether 175 for 2 beats 155 for 8. */}
              <span className="text-xs font-semibold text-muted">
                {mode === "weight"
                  ? b.over
                    ? `${b.over} reps`
                    : "—"
                  : `${b.over} ${current.unit}`}
              </span>
              <span className="tabular text-sm font-semibold">
                {b.value}
                <span className="ml-0.5 text-xs font-normal text-muted">
                  {mode === "weight" ? current.unit : "reps"}
                </span>
              </span>
              <div
                className="w-full rounded-t-lg"
                style={{
                  height: `${Math.max((b.value / max) * 100, 2)}%`,
                  background: b.color,
                }}
                role="img"
                aria-label={`${b.name}: ${b.value} ${
                  mode === "weight" ? current.unit : "reps"
                }`}
              />
              <span className="w-full truncate text-center text-xs text-muted">
                {b.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
