"use client";

import { useEffect, useState } from "react";
import { TaskRow, type Row } from "@/components/task-row";
import { GetAheadRow } from "@/components/get-ahead-row";
import { AlwaysOpenChores } from "@/components/always-open-chores";
import { OpenTasks } from "@/components/open-tasks";
import { ChoresIcon, XIcon } from "@/components/icons";
import type { GetAheadChore } from "@/lib/queries/get-ahead";

const CHORE_COLOR = "#d97706";

/** Chores pop-up: carried-over (overdue) work at the top, then today's chores,
 *  then get-ahead — mirroring the School card so the home screen stays tidy.
 *  Overdue rows arrive oldest-first from the caller. */
export function ChoresCard({
  overdue,
  today,
  getAhead,
  alwaysOpen = [],
  openTasks = [],
  owner,
}: {
  overdue: Row[];
  today: Row[];
  getAhead: GetAheadChore[];
  alwaysOpen?: React.ComponentProps<typeof AlwaysOpenChores>["chores"];
  openTasks?: React.ComponentProps<typeof OpenTasks>["tasks"];
  /** The person whose card this is — always-open and up-for-grabs are
   *  one-tap completions attributed to them. */
  owner?: React.ComponentProps<typeof OpenTasks>["owner"];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pendingOverdue = overdue.filter((r) => r.status !== "COMPLETE");
  const pendingToday = today.filter((r) => r.status !== "COMPLETE");
  const nothing =
    overdue.length === 0 &&
    today.length === 0 &&
    getAhead.length === 0 &&
    alwaysOpen.length === 0 &&
    openTasks.length === 0;
  const poolText =
    openTasks.length === 1
      ? openTasks[0].title
      : openTasks.length > 1
        ? "Up for grabs chores are available"
        : null;
  if (nothing) return null;

  const completeForToday =
    pendingOverdue.length === 0 &&
    pendingToday.length === 0 &&
    (today.length > 0 || overdue.length > 0);
  const summary =
    [
      pendingOverdue.length ? `${pendingOverdue.length} overdue` : null,
      pendingToday.length ? `${pendingToday.length} today` : null,
      !pendingOverdue.length && !pendingToday.length && getAhead.length
        ? `${getAhead.length} to get ahead`
        : null,
    ]
      .filter(Boolean)
      .join(" \u00b7 ") || "All caught up";

  const label = (t: string) => (
    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{t}</p>
  );

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden style={{ color: CHORE_COLOR }} className="flex">
          <ChoresIcon className="h-5 w-5" />
        </span>
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">Chores</h2>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-3 text-left hover:border-accent"
      >
        <span className="flex min-w-0 flex-col">
          <span className={`text-sm ${completeForToday ? "font-medium text-emerald-600" : ""}`}>
            {completeForToday ? "Complete for today!" : summary}
          </span>
          {poolText && <span className="truncate text-xs text-muted">{poolText}</span>}
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
                <span aria-hidden style={{ color: CHORE_COLOR }} className="flex">
                  <ChoresIcon className="h-5 w-5" />
                </span>
                <h2 className="font-display text-lg font-semibold">Chores</h2>
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-muted transition-colors hover:bg-ground hover:text-ink"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

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

              {alwaysOpen.length > 0 && (
                <AlwaysOpenChores chores={alwaysOpen} owner={owner} />
              )}

              {openTasks.length > 0 && (
                <OpenTasks tasks={openTasks} owner={owner} />
              )}

              {getAhead.length > 0 && (
                <div>
                  {label("Get ahead")}
                  <div className="divide-y divide-hairline rounded-lg border border-hairline bg-surface">
                    {getAhead.map((c) => (
                      <GetAheadRow key={c.taskId} chore={c} />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Jump on an upcoming chore for a small bonus &mdash; it still counts toward its own
                    week; the bonus is on top, this week.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
