"use client";

import { useEffect, useState } from "react";
import { TaskRow, type Row } from "@/components/task-row";
import { SchoolGetAhead } from "@/components/school-get-ahead";
import { formatShort } from "@/lib/dates";
import { CATEGORY_COLORS } from "@/lib/colors";
import { XIcon, SchoolIcon } from "@/components/icons";
import { AddSchoolWork } from "@/components/add-school-work";
import type { SchoolAheadSubject } from "@/lib/queries/school-get-ahead";
import type { SchoolProgress } from "@/lib/queries/school-card";

export function SchoolCard({
  overdue,
  today,
  progress,
  targetISO,
  ahead,
  addWork,
}: {
  overdue: Row[];
  today: Row[];
  progress: SchoolProgress[];
  targetISO: string | null;
  ahead: SchoolAheadSubject[];
  addWork?: {
    userId: string;
    classesByUser: Record<string, { id: string; name: string }[]>;
    subjects: string[];
    defaultDate: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [catchUpFor, setCatchUpFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const aheadCount = ahead.reduce((n, s) => n + s.items.length, 0);
  const nothing =
    overdue.length === 0 && today.length === 0 && progress.length === 0 && ahead.length === 0;
  if (nothing) return null;

  const summary =
    [
      overdue.length ? `${overdue.length} overdue` : null,
      today.length ? `${today.length} due today` : null,
      !overdue.length && !today.length && aheadCount ? `${aheadCount} to get ahead` : null,
    ]
      .filter(Boolean)
      .join(" \u00b7 ") || "All caught up";
  const completeForToday =
    overdue.length === 0 && today.length === 0 && progress.length > 0;

  const label = (t: string) => (
    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{t}</p>
  );

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden style={{ color: CATEGORY_COLORS.SCHOOL }} className="flex">
          <SchoolIcon className="h-5 w-5" />
        </span>
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">School</h2>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-3 text-left hover:border-accent"
      >
        <span className={`text-sm ${completeForToday ? "font-medium text-emerald-600" : ""}`}>
          {completeForToday ? "Complete for today!" : summary}
        </span>
        <span className="text-xs font-medium text-accent">Open</span>
      </button>

      {open && (
        <div
          className="animate-backdrop-fade fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-8 w-full max-w-lg rounded-2xl border border-hairline bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span aria-hidden style={{ color: CATEGORY_COLORS.SCHOOL }} className="flex">
                  <SchoolIcon className="h-5 w-5" />
                </span>
                <h2 className="font-display text-lg font-semibold">School</h2>
              </span>
              <div className="flex items-center gap-1">
                {addWork && (
                  <AddSchoolWork
                    userId={addWork.userId}
                    classesByUser={addWork.classesByUser}
                    subjects={addWork.subjects}
                    defaultDate={addWork.defaultDate}
                  />
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-1 text-muted transition-colors hover:bg-ground hover:text-ink"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {targetISO && (
              <p className="mb-4 text-sm text-muted">
                School year ends <span className="font-medium text-accent">{formatShort(targetISO)}</span>
              </p>
            )}

            <div className="space-y-6">
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
                    <ul className="space-y-1.5 text-sm">
                      {progress.map((p) => (
                        <li key={p.className} className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: p.color || "#94a3b8" }}
                            />
                            <span className="truncate">{p.className}</span>
                            {p.pace === "behind" && (
                              <span className="shrink-0 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                falling behind
                              </span>
                            )}
                            {p.pace === "ahead" && (
                              <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                getting ahead!
                              </span>
                            )}
                          </span>
                          {p.finishISO ? (
                            p.catchUp ? (
                              <button
                                type="button"
                                onClick={() => setCatchUpFor(p.className)}
                                className="shrink-0 text-xs font-medium text-amber-600 underline decoration-dotted underline-offset-2"
                              >
                                finishes {formatShort(p.finishISO)}
                              </button>
                            ) : (
                              <span className={`shrink-0 text-xs ${p.onTrack ? "text-muted" : "text-amber-600"}`}>
                                finishes {formatShort(p.finishISO)}
                              </span>
                            )
                          ) : (
                            <span className="shrink-0 text-xs text-muted">{"\u2014"}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {ahead.length > 0 && (
                <div>
                  {label("Do some extra work")}
                  <SchoolGetAhead subjects={ahead} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {catchUpFor &&
        (() => {
          const p = progress.find((x) => x.className === catchUpFor);
          if (!p || !p.catchUp) return null;
          const { rate, days } = p.catchUp;
          return (
            <div
              className="animate-backdrop-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
              onClick={() => setCatchUpFor(null)}
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold">Catch up in {p.className}</h3>
                  <button
                    onClick={() => setCatchUpFor(null)}
                    aria-label="Close"
                    className="rounded-full p-1 text-muted transition-colors hover:bg-ground hover:text-ink"
                  >
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-muted">
                  At the current pace it finishes{" "}
                  <span className="font-medium text-amber-600">
                    {p.finishISO ? formatShort(p.finishISO) : ""}
                  </span>
                  {targetISO ? `, past the ${formatShort(targetISO)} goal` : ""}.{" "}
                  {days != null ? (
                    <>
                      Do{" "}
                      <span className="font-medium text-ink">
                        {rate} lessons a day for the next {days} school day{days === 1 ? "" : "s"}
                      </span>{" "}
                      to finish on time.
                    </>
                  ) : (
                    <>
                      Do{" "}
                      <span className="font-medium text-ink">{rate} lessons every school day</span> to
                      finish on time.
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })()}
    </section>
  );
}
