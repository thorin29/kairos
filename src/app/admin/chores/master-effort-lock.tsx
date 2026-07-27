"use client";

import { useTransition } from "react";
import { setAllEffortLocked } from "@/lib/actions/chores";
import { LockIcon } from "@/components/icons";

export function MasterEffortLock({ allLocked }: { allLocked: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setAllEffortLocked(!allLocked))}
      title={allLocked ? "Unlock every chore's effort" : "Lock every chore's effort"}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        allLocked
          ? "border-accent bg-accent/10 text-accent"
          : "border-hairline text-muted hover:border-accent hover:text-accent"
      }`}
    >
      <LockIcon className="h-4 w-4" />
      {allLocked ? "Effort locked" : "Lock all effort"}
    </button>
  );
}
