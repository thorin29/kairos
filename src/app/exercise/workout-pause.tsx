"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal } from "./plan-file-panel";
import { endPersonalPause, loadWorkoutPauses, startPersonalPause } from "@/lib/actions/workouts";
import type { WorkoutPauseInfo } from "@/lib/workouts/pause-run";
import { addDays } from "@/lib/dates";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayText = (iso: string) => `${DOW[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${MONTH[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

const REASONS: [string, string][] = [
  ["SICK", "Sick"],
  ["HURT", "Injured"],
  ["OTHER", "Other"],
];
const LENGTHS: [number, string][] = [
  [2, "3 days"],
  [6, "1 week"],
  [13, "2 weeks"],
];

/**
 * A person's workout pause (v0.678), in their Workouts menu: the pause running
 * or ahead with End, or "Pause workouts" to start one from today. A household
 * pause (Admin) shows here too, without End.
 */
export function WorkoutPausePanel({ userId, todayISO }: { userId: string; todayISO: string }) {
  const [pauses, setPauses] = useState<WorkoutPauseInfo[] | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("SICK");
  const [until, setUntil] = useState(addDays(todayISO, 2));
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    loadWorkoutPauses(userId)
      .then((p) => live && setPauses(p))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  if (!pauses) return null;
  const mine = pauses.find((p) => p.kind === "personal");
  const house = pauses.filter((p) => p.kind === "household");
  const save = (fn: () => Promise<WorkoutPauseInfo[]>) =>
    start(async () => {
      try {
        setPauses(await fn());
      } catch {
        /* stays as it was */
      }
    });

  return (
    <div className="space-y-2">
      {[...house, ...(mine ? [mine] : [])].map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-3 py-2.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">
              {p.from > todayISO ? "Pause ahead" : "Workouts paused"} · {p.label}
            </span>
            <span className="text-xs text-muted">
              {p.from > todayISO ? `${dayText(p.from)} through ${dayText(p.to)}` : `Through ${dayText(p.to)}`}
            </span>
          </span>
          {p.kind === "personal" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => save(() => endPersonalPause(userId, p.id))}
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-hairline px-3.5 text-sm font-semibold hover:border-accent disabled:opacity-50"
            >
              End
            </button>
          )}
        </div>
      ))}
      {!mine && (
        <button
          type="button"
          onClick={() => {
            setReason("SICK");
            setUntil(addDays(todayISO, 2));
            setOpen(true);
          }}
          className="inline-flex h-11 w-full items-center justify-center rounded-full border border-hairline text-sm font-semibold hover:border-accent"
        >
          Pause workouts
        </button>
      )}
      {open && (
        <Modal title="Pause workouts" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Why?</p>
              <div className="flex flex-wrap gap-2">
                {REASONS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={reason === k}
                    onClick={() => setReason(k)}
                    className={`inline-flex h-10 items-center rounded-full border px-3.5 text-sm font-semibold ${
                      reason === k ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">From today through</p>
              <div className="flex flex-wrap items-center gap-2">
                {LENGTHS.map(([n, label]) => {
                  const d = addDays(todayISO, n);
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={until === d}
                      onClick={() => setUntil(d)}
                      className={`inline-flex h-10 items-center rounded-full border px-3.5 text-sm font-semibold ${
                        until === d ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <input
                  type="date"
                  aria-label="Last day of the pause"
                  value={until}
                  min={todayISO}
                  max={addDays(todayISO, 90)}
                  onChange={(e) => e.target.value && setUntil(e.target.value)}
                  className="h-10 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 items-center rounded-full border border-hairline px-4 text-sm font-semibold">
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  save(() => startPersonalPause(userId, reason, until));
                  setOpen(false);
                }}
                className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50"
              >
                Start pause
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
