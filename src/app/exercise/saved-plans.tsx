"use client";

import { useState } from "react";
import { PlanLibrary } from "./my-plans";
import { PlanFilePanel } from "./plan-file-panel";

/**
 * Saved plans (v0.747), a button of its own on the Workouts page: My plans and
 * Household plans to open, and saving, sharing, exporting or importing this
 * plan. Moved here from the foot of the plan editor.
 */
export function SavedPlans({ userId, onUsed }: { userId: string; onUsed: () => void }) {
  const [tab, setTab] = useState<"mine" | "household">("mine");
  return (
    <div className="space-y-4">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-ground p-1">
        {(
          [
            ["mine", "My plans"],
            ["household", "Household"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`h-9 rounded-full text-sm font-semibold ${tab === k ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <PlanLibrary key={tab} userId={userId} kind={tab} onUsed={onUsed} />
      <div className="space-y-2 rounded-xl border border-hairline bg-surface p-3.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">This plan</p>
        <PlanFilePanel userId={userId} inline />
      </div>
    </div>
  );
}
