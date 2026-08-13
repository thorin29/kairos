"use client";

import { useTransition } from "react";
import { resetScoring } from "@/lib/actions/settings";
import { formatLong } from "@/lib/dates";

export function ResetScoringButton({ current }: { current: string | null }) {
  const [pending, startTransition] = useTransition();

  const confirmText =
    "Start fresh from today?\n\n" +
    "This clears the overdue-chore backlog and counts scores from today " +
    "forward. Streaks, badges, rewards, schedules and assignments are all " +
    "kept — nothing is deleted. This can't be undone.";

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <p className="text-sm font-medium">Reset scoring</p>
      <p className="mt-2 text-sm text-muted">
        {current
          ? `Scores currently count from ${formatLong(current)}.`
          : "Scores currently count everything so far."}
      </p>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Starts everyone even from today and clears out overdue chores, without
        changing any schedules, assignments or workouts. Streaks, badges,
        rewards and the money ledger all carry over &mdash; nothing is deleted.
        Good for after a testing period, or a fresh start following an unplanned
        break.
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
