"use client";

import { useState, useTransition } from "react";
import { addCollaborativeChore } from "@/lib/actions/chores";
import { PlusIcon } from "@/components/icons";
import { DAY_NAMES } from "@/lib/days";
import { EFFORT_LEVELS } from "@/lib/chores/effort";

type Person = { id: string; name: string; color: string };

const FREQUENCIES = [
  { weeks: 1, label: "Every week" },
  { weeks: 2, label: "Every other week" },
  { weeks: 3, label: "Every 3 weeks" },
  { weeks: 4, label: "Every 4 weeks" },
];

export function CollaborativeForm({ people }: { people: Person[] }) {
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [dayOfWeek, setDayOfWeek] = useState(6); // Saturday
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [startISO, setStartISO] = useState(() => new Date().toISOString().slice(0, 10));
  const [effort, setEffort] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await addCollaborativeChore({
        title,
        userIds: [...chosen],
        dayOfWeek,
        intervalWeeks,
        startISO,
        effort,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setTitle("");
        setChosen(new Set());
        setIntervalWeeks(1);
      }
    });
  };

  const field =
    "h-11 rounded-full border border-hairline bg-surface px-4 outline-none focus:border-accent";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        One chore several people share &mdash; everyone assigned has to do their
        part. Each person gets it on their own list; the chore is finished once
        they&rsquo;ve all done it.
      </p>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Chore</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Tidy the playroom"
          className={`${field} w-full sm:max-w-sm`}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Who shares it</label>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => {
            const on = chosen.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  on
                    ? "border-accent bg-accent text-white"
                    : "border-hairline text-muted hover:border-accent",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: on ? "#fff" : p.color }}
                />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Day</label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className={field}
          >
            {DAY_NAMES.map((name, day) => (
              <option key={day} value={day}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">How often</label>
          <select
            value={intervalWeeks}
            onChange={(e) => setIntervalWeeks(Number(e.target.value))}
            className={field}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.weeks} value={f.weeks}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Starting</label>
          <input
            type="date"
            value={startISO}
            onChange={(e) => setStartISO(e.target.value)}
            className={`tabular ${field}`}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Effort</label>
          <div className="inline-flex h-11 items-center rounded-full border border-hairline p-0.5">
            {EFFORT_LEVELS.map((lvl) => {
              const on = effort === lvl.value;
              return (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => setEffort(lvl.value)}
                  className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium transition-colors"
                  style={on ? { backgroundColor: lvl.color, color: "#fff" } : { color: "var(--color-muted)" }}
                >
                  {lvl.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          Add collaborative chore
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
