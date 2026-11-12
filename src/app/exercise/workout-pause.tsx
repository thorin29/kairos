"use client";

import { useEffect, useState, useTransition } from "react";
import { PRIMARY_BTN } from "./buttons";
import { endPersonalPause, loadWorkoutPauses, startPersonalPause } from "@/lib/actions/workouts";
import type { WorkoutPauseInfo } from "@/lib/workouts/pause-run";
import { addDays } from "@/lib/dates";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayText = (iso: string) => `${DOW[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${MONTH[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

const REASONS: [string, string][] = [
  ["SICK", "Sick"],
  ["HURT", "Injured"],
  ["VACATION", "Vacation"],
  ["OTHER", "Other"],
];
const LENGTHS: [number, string][] = [
  [2, "3 days"],
  [6, "1 week"],
  [13, "2 weeks"],
];
const LABEL = "text-xs font-semibold uppercase tracking-widest text-muted";
const CHIP = (on: boolean) =>
  `inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${
    on ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
  }`;
const DATE = "h-11 rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent";

function usePauses(userId: string) {
  const [pauses, setPauses] = useState<WorkoutPauseInfo[] | null>(null);
  useEffect(() => {
    let live = true;
    loadWorkoutPauses(userId)
      .then((p) => live && setPauses(p))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);
  return { pauses, setPauses };
}

const spanText = (p: WorkoutPauseInfo, todayISO: string) =>
  p.from > todayISO ? `${dayText(p.from)} through ${dayText(p.to)}` : `Through ${dayText(p.to)}`;

/**
 * Workout pauses on the Workouts menu (v0.678; v0.680 a summary that opens the
 * full page): any pause running or ahead, else "Pause workouts".
 */
export function WorkoutPauseCard({ userId, todayISO, onOpen }: { userId: string; todayISO: string; onOpen: () => void }) {
  const { pauses } = usePauses(userId);
  if (!pauses) return null;
  const first = pauses[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-left hover:border-accent"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">
          {first ? `${first.from > todayISO ? "Pause ahead" : "Workouts paused"} · ${first.label}` : "Pause workouts"}
        </span>
        {first && (
          <span className="text-xs text-muted">
            {spanText(first, todayISO)}
            {pauses.length > 1 ? ` · ${pauses.length - 1} more` : ""}
          </span>
        )}
      </span>
      <span aria-hidden className="text-muted">
        ›
      </span>
    </button>
  );
}

/**
 * Pause workouts, a full page (v0.680): household pauses (from Admin) and the
 * person's own, each of theirs with End or Remove; a new one with a reason
 * and its exact first and last day, so one can be planned ahead.
 */
export function WorkoutPausePage({ userId, todayISO, onBack }: { userId: string; todayISO: string; onBack: () => void }) {
  const { pauses, setPauses } = usePauses(userId);
  const [reason, setReason] = useState("SICK");
  const [from, setFrom] = useState(todayISO);
  const [to, setTo] = useState(addDays(todayISO, 2));
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<WorkoutPauseInfo[]>) =>
    start(async () => {
      try {
        setPauses(await fn());
      } catch {
        /* stays as it was */
      }
    });
  const pickFrom = (v: string) => {
    setFrom(v);
    if (to < v) setTo(v);
    else if (to > addDays(v, 179)) setTo(addDays(v, 179));
  };

  return (
    <div className="space-y-5">
      <div>
        <button type="button" onClick={onBack} className="mb-3 text-sm font-medium text-accent hover:underline">
          &lsaquo; Back
        </button>
        <h3 className="font-display text-lg font-semibold">Pause workouts</h3>
      </div>

      {pauses && pauses.length > 0 && (
        <div className="space-y-2">
          <p className={LABEL}>Pauses</p>
          {pauses.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-3 py-2.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold">
                  {p.label}
                  {p.kind === "household" ? " · household" : ""}
                </span>
                <span className="text-xs text-muted">{spanText(p, todayISO)}</span>
              </span>
              {p.kind === "personal" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => save(() => endPersonalPause(userId, p.id))}
                  className="inline-flex h-9 shrink-0 items-center rounded-full border border-hairline px-3.5 text-sm font-semibold hover:border-accent disabled:opacity-50"
                >
                  {p.from > todayISO ? "Remove" : "End"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-hairline bg-surface px-4 py-4">
        <p className={LABEL}>New pause</p>
        <div>
          <p className="mb-2 text-sm font-semibold">Why?</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={reason === k} onClick={() => setReason(k)} className={CHIP(reason === k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            First day
            <input
              type="date"
              value={from}
              min={todayISO}
              max={addDays(todayISO, 365)}
              onChange={(e) => e.target.value && pickFrom(e.target.value)}
              className={DATE}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Last day
            <input type="date" value={to} min={from} max={addDays(from, 179)} onChange={(e) => e.target.value && setTo(e.target.value)} className={DATE} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {LENGTHS.map(([n, label]) => {
            const d = addDays(from, n);
            return (
              <button key={n} type="button" aria-pressed={to === d} onClick={() => setTo(d)} className={CHIP(to === d)}>
                {label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={pending || to < from}
          onClick={() => save(() => startPersonalPause(userId, reason, from, to))}
          className={`${PRIMARY_BTN} w-full`}
        >
          {from > todayISO ? "Plan pause" : "Start pause"}
        </button>
      </div>
    </div>
  );
}
