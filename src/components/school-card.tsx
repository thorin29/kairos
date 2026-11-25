"use client";

import { useState } from "react";
import { formatShort } from "@/lib/dates";
import { CATEGORY_COLORS } from "@/lib/colors";
import { XIcon, SchoolIcon } from "@/components/icons";
import { HomeTile, TileNote, TileTitle } from "@/components/home-tile";
import type { Row } from "@/components/task-row";
import type { SchoolProgress } from "@/lib/queries/school-card";

/**
 * School's home tile (v0.799), the same as the app's: green when done, red
 * with a count when something's overdue. It opens School's own page (v0.800).
 */
export function SchoolTile({ overdue, today, href }: { overdue: Row[]; today: Row[]; href: string }) {
  const pendingOverdue = overdue.filter((r) => r.status !== "COMPLETE");
  const pendingToday = today.filter((r) => r.status !== "COMPLETE");
  const summary =
    pendingOverdue.length || pendingToday.length
      ? [pendingOverdue.length ? `${pendingOverdue.length} overdue` : null, pendingToday.length ? `${pendingToday.length} due today` : null]
          .filter(Boolean)
          .join(" \u00b7 ")
      : "Nothing due today";
  const completeForToday = pendingOverdue.length === 0 && pendingToday.length === 0 && (today.length > 0 || overdue.length > 0);
  return (
    <HomeTile
      icon={<SchoolIcon className="h-[18px] w-[18px]" />}
      color={CATEGORY_COLORS.SCHOOL}
      label="School"
      state={completeForToday ? "done" : pendingOverdue.length ? "overdue" : "normal"}
      badge={pendingOverdue.length ? String(pendingOverdue.length) : null}
      href={href}
    >
      <TileTitle>{completeForToday ? "All caught up" : summary}</TileTitle>
      {!completeForToday && pendingToday[0] && <TileNote>{pendingToday[0].title}</TileNote>}
    </HomeTile>
  );
}

/** Each class's pace and finish date, with "how to catch up" behind a late one. */
export function SchoolProgressList({ progress, targetISO }: { progress: SchoolProgress[]; targetISO: string | null }) {
  const [catchUpFor, setCatchUpFor] = useState<string | null>(null);
  return (
    <>
      <div className="px-4 py-3">
        <ul className="space-y-1.5 text-sm">
                      {progress.map((p) => (
                        <li key={p.className} className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: p.color || "#94a3b8" }}
                            />
                            <span className="truncate">{p.className}</span>
                            {p.paused && (
                              <span className="shrink-0 rounded bg-ground px-1.5 py-0.5 text-[10px] font-medium text-muted">
                                paused
                              </span>
                            )}
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
                          {p.paused ? (
                            <span className="shrink-0 text-xs text-muted">
                              {p.done}/{p.total}
                            </span>
                          ) : p.finishISO ? (
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
        {targetISO && (
          <p className="mt-3 border-t border-hairline pt-3 text-xs text-muted">
            School year ends <span className="font-medium text-accent">{formatShort(targetISO)}</span>
          </p>
        )}
      </div>

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
    </>
  );
}
