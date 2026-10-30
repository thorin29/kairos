"use client";

import { useState, useTransition } from "react";
import { exportWorkouts } from "@/lib/actions/workout-export";

/**
 * Downloads everything the workouts area holds as one JSON file: plans,
 * movements, HIIT workouts, every logged set and the workout tasks due and
 * done. Reads only.
 */
export function WorkoutExport() {
  const [anonymise, setAnonymise] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const download = () =>
    start(async () => {
      setError(null);
      try {
        const json = await exportWorkouts({ anonymise });
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kairos-workouts-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        setError("Couldn't build the export. Try again.");
      }
    });

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-medium">Workout export</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={anonymise}
              onChange={(e) => setAnonymise(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Hide names
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={download}
            className="inline-flex h-10 items-center rounded-full border border-accent/40 bg-accent/5 px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {pending ? "Building…" : "Download"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
