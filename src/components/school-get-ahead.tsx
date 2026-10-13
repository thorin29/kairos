"use client";

import { useState, useTransition } from "react";
import { addSchoolWorkToToday } from "@/lib/actions/class-plans";
import { formatShort } from "@/lib/dates";
import { CheckIcon, ChevronLeftIcon } from "@/components/icons";
import type { SchoolAheadSubject } from "@/lib/queries/school-get-ahead";

export function SchoolGetAhead({ subjects }: { subjects: SchoolAheadSubject[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  /** What the last Add put into today, so the subject list can confirm it. */
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const current = subjects.find((s) => s.subject === picked) ?? null;
  // Always the soonest item still queued. There is no index to keep: the list
  // is "strictly future, still pending", so adding one to today removes it from
  // this list on the next read and the next item becomes first by itself.
  //
  // It used to hold an index AND advance it on add, which double-counted — the
  // server dropped the added item and the index stepped past the one that moved
  // up, so every add skipped an assignment.
  const item = current?.items[0] ?? null;

  const pick = (subject: string) => {
    setPicked(subject);
    setJustAdded(null);
  };
  const back = () => {
    setPicked(null);
    setJustAdded(null);
  };
  const addToday = () => {
    if (!item) return;
    const id = item.taskId;
    const label = item.label;
    start(async () => {
      await addSchoolWorkToToday(id);
      // Back to the subject list. Adding one thing is the whole errand; staying
      // on the subject invited a second add nobody asked for.
      setJustAdded(label);
      setPicked(null);
    });
  };

  if (!current) {
    return (
      <div className="rounded-lg border border-hairline bg-surface p-4">
        {justAdded && (
          <p className="mb-2 flex items-start gap-1.5 text-sm font-medium text-emerald-700">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0">Added to today: {justAdded}</span>
          </p>
        )}
        <p className="mb-2 text-sm text-muted">
          Pick a subject to pull its next lesson into today &mdash; do a little extra to finish on
          time.
        </p>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s.subject}
              type="button"
              onClick={() => pick(s.subject)}
              className="rounded-full border border-hairline px-4 py-2 text-sm font-medium hover:border-accent"
            >
              {s.subject}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">{current.subject}</p>
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1 text-xs font-medium text-muted hover:border-accent hover:text-ink"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Subjects
        </button>
      </div>

      {item ? (
        <div className={`flex items-center gap-3 ${pending ? "opacity-50" : ""}`}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{item.label}</p>
            <p className="tabular mt-0.5 text-xs text-muted">due {formatShort(item.dueISO)}</p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={addToday}
            className="inline-flex h-9 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-medium text-on-accent shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
          >
            Add to today
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm">
            Nothing more queued up in {current.subject} right now.
          </p>
          <button
            type="button"
            onClick={back}
            className="mt-3 rounded-full border border-hairline px-4 py-2 text-sm font-medium hover:border-accent"
          >
            Pick another subject
          </button>
        </div>
      )}

    </div>
  );
}
