"use client";

import { useState } from "react";
import { TaskRow, type Row } from "@/components/task-row";
import { SchoolGetAhead } from "@/components/school-get-ahead";
import { formatShort } from "@/lib/dates";
import { CATEGORY_COLORS } from "@/lib/colors";
import type { SchoolAheadSubject } from "@/lib/queries/school-get-ahead";
import type { SchoolProgress } from "@/lib/queries/school-card";

export function SchoolCard({
  overdue,
  today,
  progress,
  targetISO,
  ahead,
}: {
  overdue: Row[];
  today: Row[];
  progress: SchoolProgress[];
  targetISO: string | null;
  ahead: SchoolAheadSubject[];
}) {
  const aheadCount = ahead.reduce((n, s) => n + s.items.length, 0);
  const nothing =
    overdue.length === 0 && today.length === 0 && progress.length === 0 && ahead.length === 0;
  const [open, setOpen] = useState(overdue.length > 0 || today.length > 0);

  if (nothing) return null;

  const summary =
    [
      overdue.length ? `${overdue.length} overdue` : null,
      today.length ? `${today.length} due today` : null,
      !overdue.length && !today.length && aheadCount ? `${aheadCount} to get ahead` : null,
    ]
      .filter(Boolean)
      .join(" \u00b7 ") || "All caught up";

  const label = (t: string) => (
    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{t}</p>
  );

  return (
    <section className="mt-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-3 text-left hover:border-accent"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: CATEGORY_COLORS.SCHOOL }}
          />
          <span className="text-sm font-semibold">School</span>
          <span className="text-xs text-muted">{summary}</span>
        </span>
        <span className="text-muted">{open ? "\u25be" : "\u25b8"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-6">
          {overdue.length > 0 && (
            <div>
              {label("Overdue")}
              <div className="divide-y divide-hairline rounded-lg border border-red-200 bg-surface">
                {overdue.map((r) => (
                  <TaskRow key={r.id} task={r} />
                ))}
              </div>
            </div>
          )}

          {today.length > 0 && (
            <div>
              {label("Today")}
              <div className="divide-y divide-hairline rounded-lg border border-hairline bg-surface">
                {today.map((r) => (
                  <TaskRow key={r.id} task={r} />
                ))}
              </div>
            </div>
          )}

          {progress.length > 0 && (
            <div>
              {label("Progress")}
              <div className="rounded-lg border border-hairline bg-surface p-4">
                {targetISO && (
                  <p className="mb-2 text-xs text-muted">
                    Goal: finish by {formatShort(targetISO)}
                  </p>
                )}
                <ul className="space-y-1.5 text-sm">
                  {progress.map((p) => (
                    <li key={p.className} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: p.color || "#94a3b8" }}
                        />
                        <span className="truncate">{p.className}</span>
                      </span>
                      <span className={`shrink-0 text-xs ${p.onTrack ? "text-muted" : "text-amber-600"}`}>
                        {p.overflow > 0
                          ? "won\u2019t fit \u2014 get ahead"
                          : p.finishISO
                            ? `finishes ${formatShort(p.finishISO)}${p.onTrack ? "" : " \u2014 get ahead"}`
                            : "\u2014"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {ahead.length > 0 && (
            <div>
              {label("Get ahead")}
              <SchoolGetAhead subjects={ahead} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
