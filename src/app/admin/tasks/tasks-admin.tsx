"use client";

import { useState, useTransition } from "react";
import { editTask, deleteTask } from "@/lib/actions/tasks";
import { formatShort } from "@/lib/dates";
import { Card } from "@/components/ui";
import { PencilIcon, TrashIcon, CheckIcon } from "@/components/icons";

export type AdminPerson = { id: string; name: string; color: string };
export type AdminTask = {
  id: string;
  userId: string;
  title: string;
  dueISO: string;
  done: boolean;
  overdue: boolean;
};

const FIELD =
  "w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

export function TasksAdmin({
  people,
  tasks,
  today,
}: {
  people: AdminPerson[];
  tasks: AdminTask[];
  today: string;
}) {
  const [editMode, setEditMode] = useState(false);

  const groups = people
    .map((p) => ({ person: p, items: tasks.filter((t) => t.userId === p.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm text-muted">
          {tasks.length} task{tasks.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          aria-label={editMode ? "Done editing" : "Edit the whole list"}
          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            editMode
              ? "border-accent bg-accent/10 text-accent"
              : "border-hairline text-muted hover:border-accent hover:text-accent"
          }`}
        >
          {editMode ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <PencilIcon className="h-4 w-4" />
          )}
          {editMode ? "Done" : "Edit"}
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline p-6 text-center text-sm text-muted">
          No tasks yet.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.person.id}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: g.person.color }}
                />
                <h3 className="font-display text-sm font-semibold">
                  {g.person.name}
                </h3>
              </div>
              <Card className="divide-y divide-hairline">
                {g.items.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    people={people}
                    today={today}
                    editMode={editMode}
                  />
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  people,
  today,
  editMode,
}: {
  task: AdminTask;
  people: AdminPerson[];
  today: string;
  editMode: boolean;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.dueISO);
  const [userId, setUserId] = useState(task.userId);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle(task.title);
    setDue(task.dueISO);
    setUserId(task.userId);
    setError(null);
    setEditing(false);
  }

  if (editMode && editing) {
    return (
      <div className={`space-y-2 p-4 ${pending ? "opacity-50" : ""}`}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task name"
          className={FIELD}
        />
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={due}
            min={undefined}
            onChange={(e) => setDue(e.target.value)}
            className={`${FIELD} tabular flex-1`}
          />
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={`${FIELD} flex-1`}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await editTask({ id: task.id, title, dueDate: due, userId });
                if (r.error) setError(r.error);
                else setEditing(false);
              })
            }
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={reset}
            className="rounded-md border border-hairline px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-4 ${pending ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            task.done ? "text-muted line-through" : ""
          }`}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          <span className={`tabular ${task.overdue ? "font-medium text-red-700" : ""}`}>
            due {formatShort(task.dueISO)}
          </span>
          {task.done && <span className="ml-2">· done</span>}
        </p>
      </div>

      {editMode && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Edit ${task.title}`}
            disabled={pending}
            onClick={() => setEditing(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-40"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${task.title}`}
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete "${task.title}"?`)) {
                start(() => void deleteTask(task.id));
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
