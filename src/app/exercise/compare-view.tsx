"use client";

import { useState } from "react";
import { LineChart } from "@/components/line-chart";
import type { MovementComparison } from "@/lib/queries/workouts";
import {
  CATEGORY_LABEL,
  METRIC_LABEL_SHORT,
  type WorkoutCategory,
} from "@/lib/workouts/catalog";

/**
 * Compare one pool movement across everyone who's logged it — a line per
 * person of their best value per day. The pool is what makes this possible:
 * a shared "Bench press" instead of a private one per person.
 */
export function CompareView({ movements }: { movements: MovementComparison[] }) {
  const [id, setId] = useState(movements[0]?.poolExerciseId ?? "");
  const current =
    movements.find((m) => m.poolExerciseId === id) ?? movements[0];
  if (!current) return null;

  // Group the picker by category so weights, sport, etc. sit together.
  const order: WorkoutCategory[] = [];
  const groups = new Map<WorkoutCategory, MovementComparison[]>();
  for (const m of movements) {
    if (!groups.has(m.category)) {
      groups.set(m.category, []);
      order.push(m.category);
    }
    groups.get(m.category)!.push(m);
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Compare</h2>
        <select
          value={current.poolExerciseId}
          onChange={(e) => setId(e.target.value)}
          className="h-9 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
        >
          {order.map((cat) => (
            <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
              {groups.get(cat)!.map((m) => (
                <option key={m.poolExerciseId} value={m.poolExerciseId}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <p className="mb-3 text-sm text-muted">
        Best {METRIC_LABEL_SHORT[current.metric].toLowerCase()} per day, per
        person.
      </p>

      <LineChart series={current.series} weight={current.metric === "WEIGHT"} />

      {current.series.length === 1 && (
        <p className="mt-2 text-xs text-muted">
          Only {current.series[0].name} has logged this so far — it&rsquo;ll
          fill in as others do.
        </p>
      )}
    </div>
  );
}
