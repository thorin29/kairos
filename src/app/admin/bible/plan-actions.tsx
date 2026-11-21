"use client";

import { useTransition } from "react";
import {
  combinePlans,
  deletePlan,
  publishPlan,
  unpublishPlan,
} from "@/lib/actions/reading";
import { exportPlanAction } from "@/lib/actions/reading-edit";
import { downloadText } from "@/components/plan-import";
import { TrashIcon } from "@/components/icons";

export function PlanActions({
  id,
  name,
  isPublished,
  combineWith = null,
}: {
  id: string;
  name: string;
  isPublished: boolean;
  /** The plan this one carries on from, to fold it back into. */
  combineWith?: { id: string; name: string } | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-wrap items-center gap-2">
      {combineWith && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Combine ${name} into ${combineWith.name}? Its days move into ${combineWith.name} and it becomes one plan.`)) return;
            startTransition(async () => void (await combinePlans(combineWith.id, id)));
          }}
          className="inline-flex h-9 items-center rounded-full border border-accent px-4 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          Combine with {combineWith.name}
        </button>
      )}
      <a
        href={`/admin/bible/add?plan=${id}`}
        className="inline-flex h-9 items-center rounded-full border border-hairline bg-surface px-4 text-xs font-medium text-muted hover:border-accent hover:text-accent"
      >
        Add readings
      </a>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await exportPlanAction(id);
            if (res) downloadText(res.fileName, res.text);
          })
        }
        className="inline-flex h-9 items-center rounded-full border border-hairline bg-surface px-4 text-xs font-medium text-muted hover:border-accent hover:text-accent disabled:opacity-50"
      >
        Export
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            isPublished ? void unpublishPlan(id) : void publishPlan(id),
          )
        }
        className={`inline-flex h-9 items-center rounded-full border px-4 text-xs font-medium transition-colors disabled:opacity-50 ${
          isPublished
            ? "border-accent bg-accent/10 text-accent"
            : "border-hairline bg-surface text-muted hover:border-accent hover:text-accent"
        }`}
      >
        {isPublished ? "Published" : "Publish"}
      </button>

      <button
        type="button"
        aria-label={`Delete ${name}`}
        title="Delete plan"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${name}"? Readings already ticked stay.`)) {
            startTransition(() => void deletePlan(id));
          }
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </span>
  );
}
