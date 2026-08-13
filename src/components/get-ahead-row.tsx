"use client";

import { useTransition } from "react";
import { toggleTask } from "@/lib/actions/tasks";
import { formatShort } from "@/lib/dates";
import { FlameIcon } from "@/components/icons";

type Row = {
  taskId: string;
  title: string;
  dueDateISO: string;
  bonus: number;
};

export function GetAheadRow({ chore }: { chore: Row }) {
  const [pending, startTransition] = useTransition();

  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${pending ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate">{chore.title}</p>
        <p className="tabular mt-0.5 text-xs text-muted">
          due {formatShort(chore.dueDateISO)}
        </p>
      </div>

      <span className="tabular inline-flex items-center gap-1 text-xs font-medium text-orange-600">
        <FlameIcon className="h-3.5 w-3.5" />+{chore.bonus}
      </span>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void toggleTask(chore.taskId))}
        className="inline-flex h-9 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
      >
        Do it now
      </button>
    </li>
  );
}
