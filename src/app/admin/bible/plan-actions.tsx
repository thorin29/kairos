"use client";

import { useTransition } from "react";
import {
  deletePlan,
  publishPlan,
  unpublishPlan,
} from "@/lib/actions/reading";
import { TrashIcon } from "@/components/icons";

export function PlanActions({
  id,
  name,
  isPublished,
}: {
  id: string;
  name: string;
  isPublished: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex items-center gap-2">
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
            : "border-hairline text-muted hover:border-accent hover:text-accent"
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
