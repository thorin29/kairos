"use client";

import { useTransition } from "react";
import { deleteTask, toggleTask } from "@/lib/actions/tasks";
import { CATEGORY_LABELS } from "@/lib/colors";
import { formatShort } from "@/lib/dates";
import { TrashIcon } from "@/components/icons";

type Row = {
  id: string;
  title: string;
  category: keyof typeof CATEGORY_LABELS;
  status: string;
  dueDateISO: string;
  isOverdue: boolean;
  stale?: boolean;
  /** Generated from a chore: only a parent can remove it, from Chores. */
  locked?: boolean;
};

export function TaskRow({ task }: { task: Row }) {
  const [pending, startTransition] = useTransition();
  const done = task.status === "COMPLETE";

  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 ${pending ? "opacity-50" : ""}`}
    >
      <input
        type="checkbox"
        checked={done}
        disabled={pending || task.stale}
        onChange={() => startTransition(() => void toggleTask(task.id))}
        className="h-5 w-5 shrink-0 accent-[var(--color-accent)]"
        aria-label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
      />

      <div className="min-w-0 flex-1">
        <p
          className={
            done || task.stale ? "text-muted line-through" : undefined
          }
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {CATEGORY_LABELS[task.category]}
          {task.stale && <span className="ml-2">expired</span>}
          {task.isOverdue && (
            <span className="tabular ml-2 font-medium text-red-700">
              due {formatShort(task.dueDateISO)}
            </span>
          )}
        </p>
      </div>

      {!task.locked && (
        <button
          type="button"
          aria-label={`Delete ${task.title}`}
          title={`Delete ${task.title}`}
          disabled={pending}
          onClick={() => {
            if (confirm(`Delete "${task.title}"?`)) {
              startTransition(() => void deleteTask(task.id));
            }
          }}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
