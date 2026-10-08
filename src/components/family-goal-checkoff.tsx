"use client";

import { useState, useTransition } from "react";
import { grantCoopReward } from "@/lib/actions/coop";
import { CheckIcon } from "@/components/icons";

/**
 * The parent-only check-off, on the home banner.
 *
 * Only rendered when the gate is already met and the viewer is a parent, but
 * the rule is enforced in grantCoopCore regardless — this button is the
 * convenience, not the control.
 */
export function GoalCheckOff({ proposalId }: { proposalId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await grantCoopReward(proposalId);
            setError(res.error);
          })
        }
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        <CheckIcon className="h-4 w-4" />
        {pending ? "Saving…" : "We did it"}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
