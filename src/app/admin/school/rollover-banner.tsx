"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createNextSemester,
  snoozeRollover,
  setRolloverInterval,
  type SchoolActionState,
} from "@/lib/actions/school";
import type { RolloverState } from "@/lib/queries/school";

const initial: SchoolActionState = { error: null };
const FIELD =
  "mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

export function RolloverBanner({ state }: { state: RolloverState }) {
  const [result, action, pending] = useActionState(
    createNextSemester,
    initial,
  );
  const [busy, start] = useTransition();
  const [remindDays, setRemindDays] = useState(state.intervalDays);

  // Every candidate is ticked to reuse by default — the common case is
  // carrying the same classes forward.
  const [reuse, setReuse] = useState<Set<string>>(
    () => new Set(state.candidates.map((c) => c.id)),
  );
  const toggle = (id: string) =>
    setReuse((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    setRemindDays(state.intervalDays);
  }, [state.intervalDays]);

  return (
    <div className="mb-10 rounded-2xl border border-accent/30 bg-accent/10 p-5">
      <h3 className="font-display text-lg font-semibold">
        Time to start a new semester
      </h3>
      <p className="mt-1 text-sm text-muted">
        {state.fromTerm
          ? `${state.fromTerm.name} ended. Set up the next term below — tick the classes to carry over.`
          : "Set up the next term below."}
      </p>

      <form action={action} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium">Semester name</label>
            <input
              name="name"
              required
              maxLength={60}
              placeholder="Spring 2026"
              className={FIELD}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Starts</label>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={state.suggestedStartISO}
              className={FIELD}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Ends</label>
            <input
              type="date"
              name="endDate"
              required
              defaultValue={state.suggestedEndISO}
              className={FIELD}
            />
          </div>
        </div>

        {state.candidates.length > 0 && (
          <div>
            <p className="text-sm font-medium">Reuse classes</p>
            <div className="mt-2 space-y-1.5">
              {state.candidates.map((c) => {
                const on = reuse.has(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm"
                  >
                    {on && <input type="hidden" name="reuse" value={c.id} />}
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(c.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted">
                        {" \u00b7 "}
                        {c.memberNames.join(", ")}
                        {c.meeting ? ` \u00b7 ${c.meeting}` : ""}
                        {c.typeName ? ` \u00b7 ${c.typeName}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {result.error && (
          <p className="text-sm text-red-700">{result.error}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || busy}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending
              ? "Creating\u2026"
              : reuse.size > 0
                ? `Create semester \u00b7 reuse ${reuse.size}`
                : "Create semester"}
          </button>

          <button
            type="button"
            disabled={pending || busy}
            onClick={() => start(() => void snoozeRollover())}
            className="rounded-md border border-hairline px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            Remind me later
          </button>

          <span className="ml-auto flex items-center gap-2 text-xs text-muted">
            Remind again every
            <input
              type="number"
              min={1}
              max={90}
              value={remindDays}
              disabled={busy}
              onChange={(e) => setRemindDays(Number(e.target.value))}
              onBlur={() => {
                if (remindDays !== state.intervalDays)
                  start(() => void setRolloverInterval(remindDays));
              }}
              className="w-14 rounded-md border border-hairline bg-surface px-2 py-1 text-center text-xs outline-none focus:border-accent"
            />
            days
          </span>
        </div>
      </form>
    </div>
  );
}
