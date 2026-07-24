"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTask, type TaskActionState } from "@/lib/actions/tasks";

const initial: TaskActionState = { error: null };

type Person = { id: string; name: string; color: string };

export function AddTaskForm({
  people,
  defaultUserId,
  defaultDate,
}: {
  people: Person[];
  defaultUserId?: string;
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addTask, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [state, pending]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
      >
        Add task
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="w-full rounded-xl border border-hairline bg-surface p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className="block text-sm font-medium">
            Task
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={120}
            autoFocus
            placeholder="What needs doing?"
            className="mt-1.5 w-full rounded-md border border-hairline px-3 py-2 outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="userId" className="block text-sm font-medium">
            For
          </label>
          <select
            id="userId"
            name="userId"
            defaultValue={defaultUserId ?? people[0]?.id}
            className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 outline-none focus:border-accent"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium">
            Due
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={defaultDate}
            className="tabular mt-1.5 w-full rounded-md border border-hairline px-3 py-2 outline-none focus:border-accent"
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding\u2026" : "Add task"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-hairline px-4 py-2 text-sm font-medium text-muted"
        >
          Done
        </button>
      </div>
    </form>
  );
}
