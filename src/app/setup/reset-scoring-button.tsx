"use client";

import { useTransition } from "react";
import { resetScoring } from "@/lib/actions/settings";
import { formatLong } from "@/lib/dates";

export function ResetScoringButton({ current }: { current: string | null }) {
  const [pending, startTransition] = useTransition();

  const confirmText =
    "Start a new game from today?\n\n" +
    "This resets everything the scoreboard tracks — scores, character levels, " +
    "stats, streaks, badges and the season — and clears the overdue-chore " +
    "backlog. Schedules, assignments and the money ledger are kept; nothing " +
    "is deleted. This can't be undone.";

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <p className="text-sm font-medium">Reset progression</p>
      <p className="mt-2 text-sm text-muted">
        {current
          ? `Scores, levels, streaks and badges currently count from ${formatLong(current)}.`
          : "Scores, levels, streaks and badges currently count everything so far."}
      </p>
      <p className="mt-2 max-w-xl text-sm text-muted">
        A clean slate from today: scores, character levels, stats, streaks,
        badges and the season all start over, and the overdue-chore backlog is
        cleared. Schedules, assignments, workouts and the money ledger are
        untouched &mdash; nothing is deleted. Use it once to wipe a testing
        period, or for a true fresh start.
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(confirmText)) return;
          startTransition(async () => {
            const result = await resetScoring();
            if (result?.error) alert(result.error);
          });
        }}
        className="mt-4 inline-flex h-11 items-center rounded-full border border-red-300 px-5 text-sm font-medium text-red-700 transition-all hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "Resetting\u2026" : "Reset from today"}
      </button>
    </div>
  );
}
