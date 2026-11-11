"use client";

import { useActionState, useState } from "react";
import { DateField } from "@/components/date-field";
import { recurLabel } from "@/lib/tasks/recur-rule";
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

// Ascending, as "Repeats every N …" reads (v0.668).
const UNITS: [string, string][] = [
  ["DAILY", "days"],
  ["WEEKLY", "weeks"],
  ["MONTHLY", "months"],
  ["YEARLY", "years"],
];
const DOW = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const dowOf = (iso: string) => DOW[new Date(`${iso}T12:00:00Z`).getUTCDay()] ?? "SU";

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
  // "Repeats": Daily, Weekly, Monthly, Yearly (every one, from the first due
  // date), or Custom (every N days, weeks, months or years; weekdays) (v0.668).
  const [repeat, setRepeat] = useState("WEEKLY");
  const [unit, setUnit] = useState("DAILY");
  const [every, setEvery] = useState(1);
  const [days, setDays] = useState<string[]>([]);
  const [start, setStart] = useState(today);
  const [endMode, setEndMode] = useState("NEVER");
  const custom = repeat === "CUSTOM";
  const freq = custom ? unit : repeat;
  const interval = custom ? Math.max(1, Math.min(999, every || 1)) : 1;
  const byday = freq !== "WEEKLY" ? [] : custom && days.length > 0 ? days : [dowOf(start)];
  const preset = (f: string) => recurLabel({ freq: f, interval: 1, byday: null, startISO: start });

  return (
    <section className="mt-12 border-t border-hairline pt-8">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        Recurring tasks
      </h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        A repeating to-do that shows up on its own, counted from its first due
        date.
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

        <input type="hidden" name="freq" value={freq} />
        <input type="hidden" name="interval" value={interval} />
        {byday.map((d) => (
          <input key={d} type="hidden" name="byday" value={d} />
        ))}
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">First due</span>
            <DateField
              name="startDate"
              value={start}
              onChange={setStart}
              ariaLabel="First due date"
              className="rounded-lg border border-hairline px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Repeats</span>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className="rounded-lg border border-hairline px-3 py-2 text-sm"
            >
              {["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].map((f) => (
                <option key={f} value={f}>
                  {preset(f)}
                </option>
              ))}
              <option value="CUSTOM">Custom…</option>
            </select>
          </label>
          {custom && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Repeats every</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={every}
                  onChange={(e) => setEvery(Number(e.target.value))}
                  className="w-20 rounded-lg border border-hairline px-3 py-2 text-sm"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="rounded-lg border border-hairline px-3 py-2 text-sm"
                >
                  {UNITS.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          )}
        </div>

        {custom && unit === "WEEKLY" && (
          <div>
            <span className="mb-1 block text-sm font-medium">On</span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={days.includes(code)}
                  onClick={() => setDays((cur) => (cur.includes(code) ? cur.filter((d) => d !== code) : [...cur, code]))}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    days.includes(code) ? "border-accent bg-accent/10" : "border-hairline"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {custom && (
          <p className="text-sm text-muted">
            {recurLabel({ freq, interval, byday: byday.join(","), startISO: start })}
          </p>
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
              <DateField
                name="until"
                disabled={endMode !== "UNTIL"}
                ariaLabel="Until"
                className="rounded-lg border border-hairline px-2 py-1 text-sm"
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
