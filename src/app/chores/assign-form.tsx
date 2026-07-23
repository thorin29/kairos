"use client";

import { useActionState, useEffect, useRef } from "react";
import { assignChore, type ChoreActionState } from "@/lib/actions/chores";
import { PlusIcon } from "@/components/icons";
import { DAY_NAMES } from "@/lib/queries/chores-summary";

const initial: ChoreActionState = { error: null };

const field =
  "h-11 rounded-full border border-hairline bg-surface px-4 outline-none focus:border-accent";

export function AssignForm({
  chores,
  people,
}: {
  chores: { id: string; title: string }[];
  people: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignChore, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="choreId" className="mb-1.5 block text-sm font-medium">
            Chore
          </label>
          <select id="choreId" name="choreId" required className={`${field} w-full`}>
            <option value="">Choose a chore</option>
            {chores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[9rem]">
          <label htmlFor="userId" className="mb-1.5 block text-sm font-medium">
            Who
          </label>
          <select id="userId" name="userId" required className={`${field} w-full`}>
            <option value="">Choose</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[10rem]">
          <label
            htmlFor="dayOfWeek"
            className="mb-1.5 block text-sm font-medium"
          >
            Day due
          </label>
          <select
            id="dayOfWeek"
            name="dayOfWeek"
            required
            className={`${field} w-full`}
          >
            <option value="">Choose a day</option>
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          {pending ? "Assigning\u2026" : "Assign"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
