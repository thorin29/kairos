"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addChore, type ChoreActionState } from "@/lib/actions/chores";
import { PlusIcon } from "@/components/icons";
import { EFFORT_VALUES, EFFORT_DEFAULT, effortColor } from "@/lib/chores/effort";

const initial: ChoreActionState = { error: null };

export function AddChoreForm() {
  const [state, formAction, pending] = useActionState(addChore, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [effort, setEffort] = useState(EFFORT_DEFAULT);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
      setEffort(EFFORT_DEFAULT);
    }
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="effort" value={effort} />
      <div className="flex flex-wrap items-center gap-3">
        <input
          name="title"
          required
          maxLength={80}
          placeholder="Vacuum the living room"
          aria-label="New chore"
          className="h-11 min-w-[14rem] flex-1 rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent"
        />

        <div className="inline-flex items-center gap-2">
          <span className="text-xs font-medium text-muted">Effort</span>
          <div className="inline-flex rounded-full border border-hairline p-0.5">
            {EFFORT_VALUES.map((v) => {
              const on = effort === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEffort(v)}
                  title={`Effort ${v} of 5`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors"
                  style={on ? { backgroundColor: effortColor(v), color: "#fff" } : { color: "var(--color-muted)" }}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>

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
