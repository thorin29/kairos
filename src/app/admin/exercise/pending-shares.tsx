"use client";

import { useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { CheckIcon } from "@/components/icons";
import { approveHiitWorkout, dismissHiitShare } from "@/lib/actions/workouts";
import { WORKOUT_TYPE_LABEL, formatHiitMovement } from "@/lib/workouts/catalog";
import type { PendingHiitShare } from "@/lib/queries/workouts";

export function PendingShares({ shares }: { shares: PendingHiitShare[] }) {
  return (
    <section>
      <SectionHeading>Shared workout requests</SectionHeading>
      <p className="mb-3 max-w-xl text-sm text-muted">
        Approve to add a person&rsquo;s workout to the shared pool for everyone,
        or dismiss to leave it personal.
      </p>
      <Card className="divide-y divide-hairline">
        {shares.map((s) => (
          <ShareRow key={s.id} share={s} />
        ))}
      </Card>
    </section>
  );
}

function ShareRow({ share }: { share: PendingHiitShare }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {share.name}
          <span className="ml-2 text-xs font-normal text-muted">
            from {share.ownerName}
          </span>
        </p>
        <p className="truncate text-xs text-muted">
          {WORKOUT_TYPE_LABEL[share.type]}
          {share.movements.length > 0 &&
            ` · ${share.movements
              .map((m) => formatHiitMovement(m))
              .join(", ")}`}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => void dismissHiitShare(share.id))}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-ground disabled:opacity-40"
      >
        Dismiss
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => void approveHiitWorkout(share.id))}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        <CheckIcon className="h-4 w-4" />
        Approve
      </button>
    </div>
  );
}
