"use client";

import { useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { CheckIcon } from "@/components/icons";
import { approveHouseholdPlan, removeHouseholdPlan } from "@/lib/actions/workouts";
import type { SharedPlanRow } from "@/lib/workouts/plan-share-run";

/** Household plans (v0.618): approve or dismiss a shared plan, or take one down. */
export function SharedPlans({ plans }: { plans: SharedPlanRow[] }) {
  return (
    <section>
      <SectionHeading>Household plans</SectionHeading>
      <Card className="divide-y divide-hairline">
        {plans.map((p) => (
          <PlanRow key={p.id} plan={p} />
        ))}
      </Card>
    </section>
  );
}

function PlanRow({ plan }: { plan: SharedPlanRow }) {
  const [pending, start] = useTransition();
  const waiting = plan.status === "PENDING";
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {plan.name}
          {plan.by && <span className="ml-2 text-xs font-normal text-muted">from {plan.by}</span>}
        </p>
        <p className="truncate text-xs text-muted">{plan.summary}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!waiting && !confirm(`Take ${plan.name} down? Plans people started from it stay theirs.`)) return;
          start(() => void removeHouseholdPlan(plan.id));
        }}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-ground disabled:opacity-40"
      >
        {waiting ? "Dismiss" : "Remove"}
      </button>
      {waiting && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => void approveHouseholdPlan(plan.id))}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-on-accent disabled:opacity-40"
        >
          <CheckIcon className="h-4 w-4" />
          Approve
        </button>
      )}
    </div>
  );
}
