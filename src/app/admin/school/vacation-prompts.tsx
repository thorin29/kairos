"use client";

import { useTransition } from "react";
import { decideVacation } from "@/lib/actions/school-year";
import { formatShort } from "@/lib/dates";
import type { VacationPrompt } from "@/lib/queries/school-year";

export function VacationPrompts({ vacations }: { vacations: VacationPrompt[] }) {
  const [pending, start] = useTransition();
  if (vacations.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border border-sky-400/50 bg-sky-400/10 p-5">
      <h3 className="font-display text-lg font-semibold">
        Vacation{vacations.length > 1 ? "s" : ""} on the calendar
      </h3>
      <p className="mt-1 text-sm text-muted">
        These overlap the school year. Shift school work off them, or keep school running through?
      </p>
      <ul className="mt-4 space-y-2">
        {vacations.map((v) => (
          <li
            key={v.eventId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm"
          >
            <span className="min-w-0">
              <span className="font-medium">{v.title}</span>
              <span className="text-muted">
                {" "}
                &middot; {formatShort(v.start)}&ndash;{formatShort(v.end)}
              </span>
            </span>
            <span className="flex shrink-0 gap-2">
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await decideVacation(v.eventId, false);
                  })
                }
                className="rounded-md border border-accent bg-accent px-3 py-1 text-xs font-medium text-on-accent disabled:opacity-50"
              >
                Shift work off
              </button>
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await decideVacation(v.eventId, true);
                  })
                }
                className="rounded-md border border-hairline px-3 py-1 text-xs font-medium disabled:opacity-50"
              >
                Keep school on
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
