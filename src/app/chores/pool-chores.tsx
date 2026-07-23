"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import {
  addPoolChore,
  setChorePaused,
  type ChoreActionState,
} from "@/lib/actions/chores";
import { Card } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { DeleteChoreButton } from "./row-actions";

const initial: ChoreActionState = { error: null };

export type PoolChore = {
  id: string;
  title: string;
  intervalDays: number;
  isPaused: boolean;
  nextDueISO: string | null;
  outstanding: boolean;
};

export function PoolChores({ chores }: { chores: PoolChore[] }) {
  const [state, formAction, pending] = useActionState(addPoolChore, initial);
  const [busy, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [state, pending]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <form ref={formRef} action={formAction}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label htmlFor="pool-title" className="mb-1.5 block text-sm font-medium">
                Shared chore
              </label>
              <input
                id="pool-title"
                name="title"
                required
                maxLength={80}
                placeholder="Mow the lawn"
                className="h-11 w-full rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent"
              />
            </div>

            <div>
              <label
                htmlFor="intervalDays"
                className="mb-1.5 block text-sm font-medium"
              >
                Comes back after
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="intervalDays"
                  name="intervalDays"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={7}
                  className="tabular h-11 w-24 rounded-full border border-hairline px-5 outline-none focus:border-accent"
                />
                <span className="text-sm text-muted">days</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              {pending ? "Adding\u2026" : "Add"}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted">
            Nobody is assigned. It shows up for grabs on the dashboard, and the
            next round is counted from the day it&rsquo;s finished &mdash; not
            from a fixed weekday.
          </p>

          {state.error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700">
              {state.error}
            </p>
          )}
        </form>
      </Card>

      {chores.length > 0 && (
        <Card className={`divide-y divide-hairline ${busy ? "opacity-60" : ""}`}>
          {chores.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[12rem] flex-1">
                <p className="text-sm font-medium">
                  {c.title}
                  {c.isPaused && (
                    <span className="ml-2 rounded-full bg-ground px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted">
                      paused
                    </span>
                  )}
                </p>
                <p className="tabular mt-0.5 text-xs text-muted">
                  every {c.intervalDays} days after it&rsquo;s done
                  {c.isPaused
                    ? " · nothing scheduled"
                    : c.outstanding
                      ? " · out now"
                      : c.nextDueISO
                        ? ` · next ${c.nextDueISO}`
                        : ""}
                </p>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  startTransition(() => void setChorePaused(c.id, !c.isPaused))
                }
                className={`inline-flex h-9 items-center rounded-full border px-4 text-xs font-medium transition-colors disabled:opacity-50 ${
                  c.isPaused
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-hairline text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {c.isPaused ? "Resume" : "Pause"}
              </button>

              <DeleteChoreButton id={c.id} title={c.title} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
