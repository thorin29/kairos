"use client";

import { useTransition } from "react";
import { deleteTask, toggleTask } from "@/lib/actions/tasks";
import { CATEGORY_LABELS } from "@/lib/colors";
import { formatShort } from "@/lib/dates";

type Row = {
  id: string;
  title: string;
  category: keyof typeof CATEGORY_LABELS;
  status: string;
  dueDateISO: string;
  isOverdue: boolean;
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
        disabled={pending}
        onChange={() => startTransition(() => void toggleTask(task.id))}
        className="h-5 w-5 shrink-0 accent-[var(--color-accent)]"
        aria-label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
      />

      <div className="min-w-0 flex-1">
        <p className={done ? "text-muted line-through" : ""}>{task.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {CATEGORY_LABELS[task.category]}
          {task.isOverdue && (
            <span className="tabular ml-2 font-medium text-red-700">
              due {formatShort(task.dueDateISO)}
            </span>
          )}
        </p>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${task.title}"?`)) {
            startTransition(() => void deleteTask(task.id));
          }
        }}
        className="text-xs text-muted underline underline-offset-4 hover:text-red-700"
      >
        Delete
      </button>
    </li>
  );
}
