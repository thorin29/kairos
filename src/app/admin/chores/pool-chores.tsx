"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addPoolChore,
  setChorePaused,
  reopenPoolChore,
  markPoolChoreDone,
  type ChoreActionState,
} from "@/lib/actions/chores";
import { Card } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { EffortControl } from "./effort-control";
import { DeleteChoreButton } from "./row-actions";

const initial: ChoreActionState = { error: null };

export type PoolChore = {
  id: string;
  title: string;
  intervalDays: number;
  isPaused: boolean;
  nextDueISO: string | null;
  outstanding: boolean;
  claimedByName?: string | null;
  alwaysOpen?: boolean;
  perpetual?: boolean;
  effort: number;
  effortLocked: boolean;
};

export function PoolChores({
  chores,
  available,
  people,
}: {
  chores: PoolChore[];
  available: { id: string; title: string }[];
  people: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(addPoolChore, initial);
  const [busy, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [state, pending]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <form ref={formRef} action={formAction}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <label htmlFor="pool-chore" className="mb-1.5 block text-sm font-medium">
                Up for grabs chore
              </label>
              <select
                id="pool-chore"
                name="choreId"
                required
                className="h-11 w-full rounded-full border border-hairline bg-surface px-4 outline-none focus:border-accent"
              >
                <option value="">Choose a chore</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="intervalDays" className="mb-1.5 block text-sm font-medium">
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
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name="alwaysOpen" className="accent-[var(--color-accent)]" />
                Always open (no schedule) &mdash; e.g. take out the garbage
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name="perpetual" className="accent-[var(--color-accent)]" />
                Throughout the day &mdash; tap each time it&rsquo;s done (countable), e.g. refilling water
              </label>
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
          {chores.map((c) => {
            return <PoolRow key={c.id} c={c} people={people} busy={busy} onPause={() => startTransition(() => void setChorePaused(c.id, !c.isPaused))} />;
          })}
        </Card>
      )}
    </div>
  );
}

function PoolRow({
  c,
  people,
  busy,
  onPause,
}: {
  c: PoolChore;
  people: { id: string; name: string }[];
  busy: boolean;
  onPause: () => void;
}) {
  const [pending, start] = useTransition();
  const [who, setWho] = useState(people[0]?.id ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const [when, setWhen] = useState(today);
  const disabled = busy || pending;

  const status = c.isPaused
    ? "paused"
    : c.perpetual
      ? "logged throughout the day"
      : c.outstanding
      ? "up for grabs now"
      : c.claimedByName
        ? `${c.claimedByName} is on it`
        : c.nextDueISO
          ? `next ${c.nextDueISO}`
          : "";

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <EffortControl id={c.id} value={c.effort} locked={c.effortLocked} />
        <div className="min-w-[11rem] flex-1">
          <p className="text-sm font-medium">{c.title}</p>
          <p className="tabular mt-0.5 text-xs text-muted">
            {c.perpetual
              ? "tap each time it\u2019s done"
              : c.alwaysOpen
                ? "always open"
                : `every ${c.intervalDays} days after it\u2019s done`}
            {status ? ` \u00b7 ${status}` : ""}
          </p>
        </div>
        {!c.perpetual && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => start(async () => void (await reopenPoolChore(c.id)))}
            className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Open now
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={onPause}
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

      {/* Record a completion — set who did it and when, to fix the countdown. */}
      {!c.perpetual && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3 text-xs text-muted">
          <span>Mark done:</span>
          <select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            className="h-8 rounded-lg border border-hairline bg-surface px-2 text-xs"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={when}
            max={today}
            onChange={(e) => setWhen(e.target.value)}
            className="tabular h-8 rounded-lg border border-hairline bg-surface px-2 text-xs"
          />
          <button
            type="button"
            disabled={disabled || !who}
            onClick={() =>
              start(async () => {
                const r = await markPoolChoreDone({ choreId: c.id, userId: who, dateISO: when });
                if (r.error) alert(r.error);
              })
            }
            className="inline-flex h-8 items-center rounded-full bg-accent px-3 font-medium text-white disabled:opacity-50"
          >
            {pending ? "\u2026" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
