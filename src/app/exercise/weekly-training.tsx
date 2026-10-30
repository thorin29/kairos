"use client";

import { useEffect, useState } from "react";
import { loadWeeklyTrainingFor } from "@/lib/actions/workouts";
import type { TrainingWeek } from "@/lib/queries/workout-log";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Weekly training: a bar per week for the last 12 (days trained, with sets and
 * minutes on tap), and weeks trained in a row. It grows with turning up, not
 * with weight: a light week or a week of skips for an injury still counts.
 */
export function WeeklyTraining({ userId }: { userId: string }) {
  const [data, setData] = useState<{ weeks: TrainingWeek[]; inARow: number } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    loadWeeklyTrainingFor(userId)
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  if (!data || data.weeks.every((w) => w.days === 0)) return null;
  const max = Math.max(7, ...data.weeks.map((w) => w.days));
  const shown = picked != null ? data.weeks[picked] : data.weeks[data.weeks.length - 1];
  const label = (iso: string) => `${MONTH[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-display text-base font-semibold">Weekly training</h4>
        <p className="tabular text-sm">
          <span className="font-semibold">{data.inARow}</span>{" "}
          <span className="text-muted">{data.inARow === 1 ? "week" : "weeks"} in a row</span>
        </p>
      </div>
      <div className="mt-3 flex h-24 items-end gap-1.5" role="group" aria-label="Days trained per week">
        {data.weeks.map((w, i) => {
          const on = (picked ?? data.weeks.length - 1) === i;
          return (
            <button
              key={w.start}
              type="button"
              onClick={() => setPicked(i)}
              aria-label={`Week of ${label(w.start)}: ${w.days} days`}
              aria-pressed={on}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <span
                className={`block w-full rounded-t-md ${w.trained ? "bg-accent" : "bg-accent/35"} ${
                  on ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""
                }`}
                style={{ height: `${Math.max(w.days > 0 ? 8 : 2, (w.days / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <p className="tabular mt-2 text-xs text-muted">
        Week of {label(shown.start)}: {shown.days} {shown.days === 1 ? "day" : "days"} · {shown.sets}{" "}
        {shown.sets === 1 ? "set" : "sets"}
        {shown.minutes > 0 ? ` · ${shown.minutes} min` : ""}
      </p>
    </section>
  );
}
