"use client";

import { useState, useTransition } from "react";
import { exportScoringSnapshot } from "@/lib/actions/scoring-export";

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
