"use client";

import { useActionState, useEffect, useRef } from "react";
import { addChore, type ChoreActionState } from "@/lib/actions/chores";

const initial: ChoreActionState = { error: null };

export function AddChoreForm() {
  const [state, formAction, pending] = useActionState(addChore, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-hairline bg-surface p-5"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="title" className="block text-sm font-medium">
            New chore
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={80}
            placeholder="Vacuum the living room"
            className="mt-1.5 w-full rounded-md border border-hairline px-3 py-2 outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="staleAfterDays" className="block text-sm font-medium">
            Expires after
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="staleAfterDays"
              name="staleAfterDays"
              type="number"
              min={0}
              max={90}
              defaultValue={7}
              className="tabular w-20 rounded-md border border-hairline px-3 py-2 outline-none focus:border-accent"
            />
            <span className="text-sm text-muted">days</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding\u2026" : "Add chore"}
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">
        An unfinished chore stops counting once it expires, or as soon as the
        same chore comes due again for anyone. Set 0 to keep it open forever.
      </p>

      {state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
