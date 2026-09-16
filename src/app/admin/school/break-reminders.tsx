"use client";

import { useTransition } from "react";
import { confirmSchoolBreak, cancelSchoolBreak } from "@/lib/actions/school-year";
import { formatShort } from "@/lib/dates";
import type { BreakReminder } from "@/lib/queries/school-year";

export function BreakReminders({ breaks }: { breaks: BreakReminder[] }) {
  const [pending, start] = useTransition();
  if (breaks.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-5">
      <h3 className="font-display text-lg font-semibold">
        Planned break{breaks.length > 1 ? "s" : ""} coming up
      </h3>
      <p className="mt-1 text-sm text-muted">
        Is each of these happening? Cancelling one frees those days and pulls school work in to fill
        them.
      </p>
      <ul className="mt-4 space-y-2">
        {breaks.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm"
          >
            <span className="min-w-0">
              <span className="font-medium">{b.name}</span>
              <span className="text-muted">
                {" "}
                &middot; {formatShort(b.start)}&ndash;{formatShort(b.end)}
              </span>
            </span>
            <span className="flex shrink-0 gap-2">
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await confirmSchoolBreak(b.id);
                  })
                }
                className="rounded-md border border-accent bg-accent px-3 py-1 text-xs font-medium text-on-accent disabled:opacity-50"
              >
                Taking it
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  if (confirm(`Cancel "${b.name}" and pull school work into those days?`))
                    start(async () => {
                      await cancelSchoolBreak(b.id);
                    });
                }}
                className="rounded-md border border-hairline px-3 py-1 text-xs font-medium disabled:opacity-50"
              >
                Not taking it
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
