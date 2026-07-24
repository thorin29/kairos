"use client";

import { useActionState, useEffect, useRef } from "react";
import { addChore, type ChoreActionState } from "@/lib/actions/chores";
import { PlusIcon } from "@/components/icons";

const initial: ChoreActionState = { error: null };

export function AddChoreForm() {
  const [state, formAction, pending] = useActionState(addChore, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction}>
      <div className="flex flex-wrap items-center gap-3">
        <input
          name="title"
          required
          maxLength={80}
          placeholder="Vacuum the living room"
          aria-label="New chore"
          className="h-11 min-w-[16rem] flex-1 rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          {pending ? "Adding\u2026" : "Add chore"}
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
