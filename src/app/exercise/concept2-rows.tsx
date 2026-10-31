"use client";

import type { Concept2Day } from "@/lib/workouts/concept2-run";

/** The day's rows from Concept2, with Undo for a replaced hand entry and
 *  "Check now". Shown in the Cardio section, or under Extra when no rowing
 *  was planned. */
export function Concept2Rows({
  day,
  checking,
  onCheck,
  onUndo,
}: {
  day: Concept2Day;
  checking: boolean;
  onCheck: () => void;
  onUndo: (resultId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {day.rows.map((r) => (
        <div
          key={r.resultId}
          className="flex min-h-[3.5rem] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-hairline bg-surface px-4 py-3"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">From Concept2</span>
            <span className="tabular block text-xs text-muted">{r.summary}</span>
          </span>
          {r.replaced && (
            <span className="flex items-center gap-2 text-xs text-muted">
              Replaced {r.replaced}
              <button
                type="button"
                onClick={() => onUndo(r.resultId)}
                className="font-semibold text-accent hover:underline"
              >
                Undo
              </button>
            </span>
          )}
        </div>
      ))}
      <div className="flex items-center justify-end gap-3 text-xs text-muted">
        {day.error && <span className="text-red-700">{day.error}</span>}
        <button
          type="button"
          onClick={onCheck}
          disabled={checking}
          className="font-semibold text-accent hover:underline disabled:opacity-40"
        >
          {checking ? "Checking Concept2…" : "Check Concept2 now"}
        </button>
      </div>
    </div>
  );
}
