"use client";

import { useState, useTransition } from "react";
import { completeSchoolAhead } from "@/lib/actions/class-plans";
import { formatShort } from "@/lib/dates";
import type { SchoolAheadSubject } from "@/lib/queries/school-get-ahead";

export function SchoolGetAhead({ subjects }: { subjects: SchoolAheadSubject[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [pending, start] = useTransition();

  const current = subjects.find((s) => s.subject === picked) ?? null;
  const item = current ? current.items[idx] ?? null : null;

  const pick = (subject: string) => {
    setPicked(subject);
    setIdx(0);
    setDoneCount(0);
  };
  const back = () => {
    setPicked(null);
    setIdx(0);
    setDoneCount(0);
  };
  const complete = () => {
    if (!item) return;
    const id = item.taskId;
    start(async () => {
      await completeSchoolAhead(id);
      setDoneCount((n) => n + 1);
      setIdx((i) => i + 1);
    });
  };

  if (!current) {
    return (
      <div className="rounded-lg border border-hairline bg-surface p-4">
        <p className="mb-2 text-sm text-muted">
          Finished today&rsquo;s work? Pick a subject to work ahead.
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
              <span className="ml-1.5 text-xs text-muted">{s.items.length} ahead</span>
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
        <button type="button" onClick={back} className="text-xs text-muted hover:text-ink">
          Back to subjects
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
            onClick={complete}
            className="inline-flex h-9 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-medium text-on-accent shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
          >
            Mark done
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm">
            {doneCount > 0
              ? `Nice — ${doneCount} ahead in ${current.subject}. That\u2019s everything queued up here.`
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

      {item && doneCount > 0 && (
        <p className="mt-2 text-xs text-muted">{doneCount} done ahead so far.</p>
      )}
    </div>
  );
}
