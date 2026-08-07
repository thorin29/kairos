"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addSchoolWork,
  type SchoolActionState,
} from "@/lib/actions/school";
import { SCHOOL_TYPES, SCHOOL_TYPE_LABEL } from "@/lib/school";

const initial: SchoolActionState = { error: null };

const FIELD =
  "mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 outline-none focus:border-accent";

export function AddSchoolWork({
  userId,
  people,
  defaultDate,
}: {
  userId?: string;
  people?: { id: string; name: string }[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addSchoolWork, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
      if (state === initial) return;
    }
  }, [state, pending]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-hairline px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        Add assignment or test
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="w-full rounded-xl border border-hairline bg-surface p-5"
    >
      {people ? null : <input type="hidden" name="userId" value={userId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="sw-title" className="block text-sm font-medium">
            Assignment or test
          </label>
          <input
            id="sw-title"
            name="title"
            required
            maxLength={120}
            autoFocus
            placeholder="e.g. Chapter 4 problems, Unit test"
            className={FIELD}
          />
        </div>

        {people && (
          <div>
            <label htmlFor="sw-user" className="block text-sm font-medium">
              For
            </label>
            <select
              id="sw-user"
              name="userId"
              defaultValue={userId ?? people[0]?.id}
              className={FIELD}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="sw-subject" className="block text-sm font-medium">
            Subject
          </label>
          <input
            id="sw-subject"
            name="subject"
            maxLength={60}
            placeholder="Math, History…"
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="sw-type" className="block text-sm font-medium">
            Type
          </label>
          <select
            id="sw-type"
            name="type"
            defaultValue="HOMEWORK"
            className={FIELD}
          >
            {SCHOOL_TYPES.map((t) => (
              <option key={t} value={t}>
                {SCHOOL_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sw-due" className="block text-sm font-medium">
            Due
          </label>
          <input
            id="sw-due"
            name="dueDate"
            type="date"
            defaultValue={defaultDate}
            className={`tabular ${FIELD}`}
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
          {pending ? "Adding\u2026" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-hairline px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
