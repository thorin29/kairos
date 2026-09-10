"use client";

import { useActionState, useState } from "react";
import {
  addRecurringTask,
  deleteRecurringTask,
  type RecurringState,
} from "@/lib/actions/recurring-tasks";

type Person = { id: string; name: string; color: string };
type Item = { id: string; userName: string; title: string; summary: string };

const WEEKDAYS: [string, string][] = [
  ["SU", "Sun"],
  ["MO", "Mon"],
  ["TU", "Tue"],
  ["WE", "Wed"],
  ["TH", "Thu"],
  ["FR", "Fri"],
  ["SA", "Sat"],
];

const UNIT: Record<string, string> = {
  DAILY: "days",
  WEEKLY: "weeks",
  MONTHLY: "months",
};

export function RecurringTasksAdmin({
  people,
  items,
  today,
}: {
  people: Person[];
  items: Item[];
  today: string;
}) {
  const [state, action, pending] = useActionState<RecurringState, FormData>(
    addRecurringTask,
    { error: null },
  );
  const [freq, setFreq] = useState("WEEKLY");
  const [endMode, setEndMode] = useState("NEVER");

  return (
    <section className="mt-12 border-t border-hairline pt-8">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        Recurring tasks
      </h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        A repeating to-do that shows up on its own — daily, weekly on chosen
        days, or monthly. It appears on the right days automatically.
      </p>

      <form
        key={items.length}
        action={action}
        className="mt-4 space-y-3 rounded-xl border border-hairline p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Task</span>
            <input
              name="title"
              placeholder="e.g. Add work schedule to the calendar"
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm"
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">For</span>
            <select
              name="userId"
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Pick a person
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Repeats</span>
            <select
              name="freq"
              value={freq}
              onChange={(e) => setFreq(e.target.value)}
              className="rounded-lg border border-hairline px-3 py-2 text-sm"
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Every</span>
            <span className="flex items-center gap-2">
              <input
                name="interval"
                type="number"
                min={1}
                max={52}
                defaultValue={1}
                className="w-16 rounded-lg border border-hairline px-3 py-2 text-sm"
              />
              <span className="text-sm text-muted">{UNIT[freq]}</span>
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Starting</span>
            <input
              name="startDate"
              type="date"
              defaultValue={today}
              className="rounded-lg border border-hairline px-3 py-2 text-sm"
            />
          </label>
        </div>

        {freq === "WEEKLY" && (
          <div>
            <span className="mb-1 block text-sm font-medium">On</span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(([code, label]) => (
                <label
                  key={code}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-sm transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10"
                >
                  <input
                    type="checkbox"
                    name="byday"
                    value={code}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="mb-1 block text-sm font-medium">Ends</span>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="endMode"
                value="NEVER"
                checked={endMode === "NEVER"}
                onChange={() => setEndMode("NEVER")}
              />
              Never
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="endMode"
                value="COUNT"
                checked={endMode === "COUNT"}
                onChange={() => setEndMode("COUNT")}
              />
              After
              <input
                name="count"
                type="number"
                min={1}
                max={999}
                disabled={endMode !== "COUNT"}
                className="w-16 rounded-lg border border-hairline px-2 py-1 text-sm disabled:opacity-40"
              />
              times
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="endMode"
                value="UNTIL"
                checked={endMode === "UNTIL"}
                onChange={() => setEndMode("UNTIL")}
              />
              Until
              <input
                name="until"
                type="date"
                disabled={endMode !== "UNTIL"}
                className="rounded-lg border border-hairline px-2 py-1 text-sm disabled:opacity-40"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            {pending ? "Adding\u2026" : "Add recurring task"}
          </button>
          {state.error && (
            <p className="text-sm text-red-700">{state.error}</p>
          )}
        </div>
      </form>

      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline rounded-xl border border-hairline">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{it.title}</p>
                <p className="truncate text-xs text-muted">
                  {it.userName} · {it.summary}
                </p>
              </div>
              <form
                action={deleteRecurringTask.bind(null, it.id)}
                onSubmit={(e) => {
                  if (!confirm("Delete this repeating task and all of its occurrences? This can't be undone.")) e.preventDefault();
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg border border-hairline px-3 py-1.5 text-sm text-muted transition-colors hover:border-red-300 hover:text-red-700"
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
