"use client";

import { useState, useTransition } from "react";
import { exportScoringSnapshot } from "@/lib/actions/scoring-export";
import { setMonthGoalDays } from "@/lib/actions/coop";

/**
 * Admin control for how many clean days finish the month. Lives here on the
 * admin page, not on the kid-facing family-goal screen.
 */
export function MonthGoalControl({ target }: { target: number }) {
  const [value, setValue] = useState(target);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      <p className="text-sm font-medium">Days to finish the month</p>
      <p className="mt-1 text-sm text-muted">
        A child finishes the month once they&rsquo;ve had this many clean days &mdash;
        days where they completed everything assigned. It counts up and never
        drops, and every child can reach it whatever their load, since everyone
        has daily chores and Bible to finish.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <input
          type="range"
          min={1}
          max={28}
          step={1}
          value={value}
          onChange={(e) => {
            setValue(Number(e.target.value));
            setSaved(false);
          }}
          className="flex-1 accent-[var(--color-accent)]"
        />
        <span className="tabular w-20 text-right text-sm font-semibold">{value} days</span>
        <button
          type="button"
          disabled={pending || value === target}
          onClick={() =>
            start(async () => {
              const r = await setMonthGoalDays(value);
              if (r.error) alert(r.error);
              else setSaved(true);
            })
          }
          className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent shadow-sm hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving\u2026" : "Save"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
    </section>
  );
}

/**
 * A read-only dump of everyone's live scoring numbers, to copy out for tuning.
 * Nothing here is a setting — it just reports the current state.
 */
export function ScoringSnapshot() {
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const getSnapshot = () =>
    start(async () => setSnapshot(await exportScoringSnapshot()));

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Scoring snapshot</p>
          <p className="mt-1 text-sm text-muted">
            Everyone&rsquo;s live numbers &mdash; level and XP, this month&rsquo;s
            completion, streaks, companion, and each person&rsquo;s weekly XP by
            area &mdash; as JSON to copy and share for tuning. Reads only; changes
            nothing.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={getSnapshot}
          className="inline-flex h-10 shrink-0 items-center rounded-full border border-accent/40 bg-accent/5 px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? "Building\u2026" : snapshot ? "Refresh" : "Get snapshot"}
        </button>
      </div>
      {snapshot && (
        <textarea
          readOnly
          value={snapshot}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 h-56 w-full resize-y rounded-lg border border-hairline bg-ground p-3 font-mono text-[0.7rem] leading-relaxed"
        />
      )}
    </div>
  );
}
