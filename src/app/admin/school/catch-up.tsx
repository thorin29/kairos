"use client";

import { useState, useTransition } from "react";
import { rebaselineSchool } from "@/lib/actions/class-plans";
import { formatShort } from "@/lib/dates";
import { LockIcon } from "@/components/icons";
import type { RebaselineStudent } from "@/lib/school/rebaseline-core";

/** Catch up (v0.701): per student, the classes with overdue plan work and what a
 *  re-baseline would do — restart it all, oldest first, from the next school
 *  day. Classes that would then finish past their deadline are shown locked. */
export function CatchUp({ students }: { students: RebaselineStudent[] }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const readyCount = (s: RebaselineStudent) => s.behind.filter((c) => c.status === "ready").length;
  const anyReady = students.some((s) => readyCount(s) > 0);
  const firstAll = students
    .map((s) => s.firstDate)
    .filter((d): d is string => d != null)
    .sort()[0];

  const run = (userId: string | null, question: string) => {
    if (!confirm(question)) return;
    setNote(null);
    start(async () => {
      const res = await rebaselineSchool(userId);
      setNote(
        res.classes === 0
          ? "Nothing to move."
          : `Re-baselined ${res.classes} class${res.classes === 1 ? "" : "es"}.`,
      );
    });
  };

  return (
    <div className="space-y-2">
      {anyReady && (
        <div className="flex items-center justify-end gap-3">
          {note && <span className="text-xs text-muted">{note}</span>}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(null, `Restart everyone's overdue school work${firstAll ? ` on ${formatShort(firstAll)}` : ""}?`)
            }
            className="rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent disabled:opacity-50"
          >
            {pending ? "Moving…" : "Re-baseline all"}
          </button>
        </div>
      )}
      {!anyReady && note && <p className="text-right text-xs text-muted">{note}</p>}
      {students.map((s) => {
        const ready = readyCount(s);
        if (s.behind.length === 0) {
          return (
            <div key={s.userId} className="rounded-lg border border-hairline bg-surface px-4 py-3 text-sm">
              {s.name} <span className="text-muted">&middot; on schedule</span>
            </div>
          );
        }
        return (
          <div key={s.userId} className="rounded-lg border border-hairline bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
              <p className="text-sm">
                <span className="font-medium">{s.name}</span>
                {ready > 0 && (
                  <span className="text-muted">
                    {" "}
                    &middot; {ready} class{ready === 1 ? "" : "es"} &middot; {s.overdue} overdue
                  </span>
                )}
              </p>
              {ready > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      s.userId,
                      `Restart ${s.name}'s overdue school work${s.firstDate ? ` on ${formatShort(s.firstDate)}` : ""}?`,
                    )
                  }
                  className="shrink-0 rounded-md border border-hairline px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  Re-baseline
                </button>
              )}
            </div>
            <ul className="space-y-1 px-4 py-2.5 text-xs">
              {s.behind.map((c) =>
                c.status === "ready" ? (
                  <li key={c.planId} className="flex items-center justify-between gap-3">
                    <span>
                      {c.className} <span className="text-muted">&middot; {c.overdue} overdue</span>
                    </span>
                    <span className="text-muted">
                      {c.currentFinish ? `${formatShort(c.currentFinish)} → ` : ""}
                      {c.newFinish ? formatShort(c.newFinish) : "—"}
                    </span>
                  </li>
                ) : (
                  <li key={c.planId} className="flex items-center justify-between gap-3 text-muted/70">
                    <span>
                      {c.className}
                      {c.overdue > 0 ? ` \u00b7 ${c.overdue} overdue` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Would finish after its last school day">
                      <LockIcon className="h-3 w-3" /> past {c.deadline ? formatShort(c.deadline) : "\u2014"}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
