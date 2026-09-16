"use client";

import { useState, useTransition } from "react";
import { addSchoolWorkToToday } from "@/lib/actions/class-plans";
import { formatShort } from "@/lib/dates";
import { ChevronLeftIcon } from "@/components/icons";
import type { SchoolAheadSubject } from "@/lib/queries/school-get-ahead";

export function SchoolGetAhead({ subjects }: { subjects: SchoolAheadSubject[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [added, setAdded] = useState(0);
  const [pending, start] = useTransition();

  const current = subjects.find((s) => s.subject === picked) ?? null;
  const item = current ? current.items[idx] ?? null : null;

  const pick = (subject: string) => {
    setPicked(subject);
    setIdx(0);
    setAdded(0);
  };
  const back = () => {
    setPicked(null);
    setIdx(0);
    setAdded(0);
  };
  const addToday = () => {
    if (!item) return;
    const id = item.taskId;
    start(async () => {
      await addSchoolWorkToToday(id);
      setAdded((n) => n + 1);
      setIdx((i) => i + 1);
    });
  };

  if (!current) {
    return (
      <div className="rounded-lg border border-hairline bg-surface p-4">
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
            {added > 0
              ? `Added ${added} to today in ${current.subject}. That\u2019s everything queued up here.`
              : `Nothing more queued up in ${current.subject} right now.`}
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

      {item && added > 0 && (
        <p className="mt-2 text-xs text-muted">
          {added} added to today &mdash; tick them off in Today above.
        </p>
      )}
    </div>
  );
}
