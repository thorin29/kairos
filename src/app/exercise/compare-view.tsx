"use client";

import { useState } from "react";
import { LineChart } from "@/components/line-chart";
import type { MovementComparison } from "@/lib/queries/workouts";

/**
 * Compare one pool weight movement across everyone who's logged it — a line per
 * person of their best weight per day. Weights only; sport and other metrics
 * don't belong on this scale.
 */
export function CompareView({ movements }: { movements: MovementComparison[] }) {
  const weightMovements = movements.filter((m) => m.metric === "WEIGHT");
  const [id, setId] = useState(weightMovements[0]?.poolExerciseId ?? "");
  const current =
    weightMovements.find((m) => m.poolExerciseId === id) ?? weightMovements[0];
  if (!current) return null;

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

      <LineChart series={current.series} weight />
    </div>
  );
}
