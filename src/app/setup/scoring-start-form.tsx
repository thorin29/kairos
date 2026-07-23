"use client";

import { useActionState } from "react";
import {
  saveScoringStart,
  type SettingsState,
} from "@/lib/actions/settings";

const initial: SettingsState = { error: null, saved: false };

export function ScoringStartForm({ current }: { current: string | null }) {
  const [state, formAction, pending] = useActionState(
    saveScoringStart,
    initial,
  );

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-hairline bg-surface p-5"
    >
      <label htmlFor="scoringStart" className="block text-sm font-medium">
        Count scores from
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          id="scoringStart"
          name="scoringStart"
          type="date"
          defaultValue={current ?? ""}
          className="tabular h-11 rounded-full border border-hairline px-5 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving\u2026" : "Save"}
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">
        Completions and misses before this date stop counting toward the
        scoreboard. Nothing is deleted &mdash; tasks, chores, and history all
        stay. Leave it empty to count everything.
      </p>

      {state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p className="mt-3 text-sm font-medium text-emerald-700">Saved.</p>
      )}
    </form>
  );
}
