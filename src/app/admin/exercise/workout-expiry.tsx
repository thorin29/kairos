"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { setWorkoutOverdueDays } from "@/lib/actions/workouts";

const MAX = 6;

// 0..6. The top of the range is the day before the same weekday comes round
// again, so a missed workout there lives exactly until it's due again.
const OPTIONS = Array.from({ length: MAX + 1 }, (_, n) => ({
  value: n,
  label: n === 0 ? "Same day" : String(n),
  full: n === MAX,
}));

export function WorkoutExpiry({ days }: { days: number }) {
  const [value, setValue] = useState(days);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = (next: number) => {
    setValue(next);
    setSaved(false);
    start(async () => {
      await setWorkoutOverdueDays(next);
      setSaved(true);
    });
  };

  return (
    <Card className="p-5">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
        Carry a missed workout for
      </p>
      <p className="mb-3 text-sm text-muted">
        How many days a missed workout stays overdue before it expires — greys
        out, stops counting, and drops off “Carried over”. Applies to everyone.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => save(o.value)}
            aria-pressed={value === o.value}
            className={`tabular rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              value === o.value
                ? "border-accent bg-accent/10 text-accent"
                : "border-hairline text-muted hover:border-accent"
            }`}
          >
            {o.full ? "Until next due" : o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Workouts repeat weekly, so “Until next due” keeps a missed one right up
        to the day the same weekday’s workout comes round again. “Same day”
        retires it the day after it was due.
      </p>
      {pending && <p className="mt-3 text-sm text-muted">Saving…</p>}
      {saved && !pending && (
        <p className="mt-3 text-sm text-emerald-700">Saved.</p>
      )}
    </Card>
  );
}
