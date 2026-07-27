"use client";

import { useState, useTransition } from "react";
import { assignAnytimeChore } from "@/lib/actions/chores";
import { PlusIcon } from "@/components/icons";

const field =
  "h-11 rounded-full border border-hairline bg-surface px-4 outline-none focus:border-accent";

const FREQUENCIES = [
  { weeks: 1, label: "Every week" },
  { weeks: 2, label: "Every other week" },
  { weeks: 3, label: "Every 3 weeks" },
  { weeks: 4, label: "Every 4 weeks" },
];

export function AnytimeForm({
  chores,
  people,
}: {
  chores: { id: string; title: string }[];
  people: { id: string; name: string }[];
}) {
  const [choreId, setChoreId] = useState("");
  const [userId, setUserId] = useState("");
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await assignAnytimeChore({ choreId, userId, intervalWeeks });
      if (result.error) setError(result.error);
      else {
        setChoreId("");
        setUserId("");
        setIntervalWeeks(1);
      }
    });
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Sits on the person&rsquo;s list for the whole period and can be done any
        day &mdash; it only goes late at the end of the period, then starts
        over.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="mb-1.5 block text-sm font-medium">Chore</label>
          <select
            value={choreId}
            onChange={(e) => setChoreId(e.target.value)}
            className={`${field} w-full`}
          >
            <option value="">Choose a chore</option>
            {chores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[9rem]">
          <label className="mb-1.5 block text-sm font-medium">Who</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={`${field} w-full`}
          >
            <option value="">Choose</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[10rem]">
          <label className="mb-1.5 block text-sm font-medium">How often</label>
          <select
            value={intervalWeeks}
            onChange={(e) => setIntervalWeeks(Number(e.target.value))}
            className={`${field} w-full`}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.weeks} value={f.weeks}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          {pending ? "Assigning\u2026" : "Assign"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
