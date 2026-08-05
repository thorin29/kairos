"use client";

import { useActionState, useTransition } from "react";
import {
  createPause,
  deletePause,
  type PauseRow,
} from "@/lib/actions/pauses";
import { PlusIcon } from "@/components/icons";

const field =
  "h-11 rounded-full border border-hairline bg-surface px-4 outline-none focus:border-accent";

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PauseForm({ pauses }: { pauses: PauseRow[] }) {
  const [state, formAction, pending] = useActionState(createPause, {
    error: null as string | null,
  });
  const [removing, startRemove] = useTransition();

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Pause the household for a vacation or break. No chores are due while it
        lasts, those days don&rsquo;t count against anyone&rsquo;s score, and
        chores start again the day after it ends. It also drops a shaded event
        on the calendar.
      </p>

      {pauses.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {pauses.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-4 py-2.5"
            >
              <span className="text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted">
                  {" "}
                  · {fmt(p.startISO)} – {fmt(p.endISO)}
                </span>
              </span>
              <button
                type="button"
                disabled={removing}
                onClick={() =>
                  startRemove(async () => {
                    await deletePause(p.id);
                  })
                }
                className="shrink-0 rounded-full px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1.5 block text-sm font-medium">Name</label>
          <input
            name="name"
            maxLength={80}
            placeholder="Vacation to the Grand Canyon"
            className={`${field} w-full`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Type</label>
          <select name="type" defaultValue="VACATION" className={field}>
            <option value="VACATION">Vacation</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">From</label>
          <input name="start" type="date" required className={`tabular ${field}`} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">To</label>
          <input name="end" type="date" required className={`tabular ${field}`} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 font-semibold text-white disabled:opacity-40"
        >
          <PlusIcon className="h-4 w-4" />
          {pending ? "Adding…" : "Add pause"}
        </button>
      </form>

      {state.error && (
        <p className="mt-2 text-sm text-red-700">{state.error}</p>
      )}
    </div>
  );
}
