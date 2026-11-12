"use client";

import { useEffect, useState, useTransition } from "react";
import { PRIMARY_BTN } from "./buttons";
import { ActionButton } from "./action-button";
import { PauseIcon } from "@/components/icons";
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
const LABEL = "text-xs font-semibold uppercase tracking-widest text-muted";
const CHIP = (on: boolean) =>
  `inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${
    on ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
  }`;
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

/**
 * A month you can page through (today up to a year on) for picking a pause's
 * range (v0.684): first tap the first day, second tap the last; a tap after
 * that starts again. The ends filled, the days between tinted, today ringed.
 */
function RangeCalendar({
  from,
  to,
  todayISO,
  onTap,
}: {
  from: string | null;
  to: string | null;
  todayISO: string;
  onTap: (iso: string) => void;
}) {
  const [ym, setYm] = useState((from ?? todayISO).slice(0, 7));
  const first = todayISO.slice(0, 7);
  const last = addDays(todayISO, 365).slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setYm(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(`${ym}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return (
    <div className="select-none">
      <div className="mb-2 flex items-center">
        <button
          type="button"
          aria-label="Previous month"
          disabled={ym <= first}
          onClick={() => shift(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-ground disabled:opacity-30"
        >
          ‹
        </button>
        <p className="flex-1 text-center text-sm font-semibold">
          {MONTH_FULL[m - 1]} {y}
        </p>
        <button
          type="button"
          aria-label="Next month"
          disabled={ym >= last}
          onClick={() => shift(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-ground disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso, i) => {
          if (!iso) return <span key={i} className="h-10" />;
          const off = iso < todayISO;
          const end = iso === from || iso === to;
          const inRange = !!from && !!to && iso >= from && iso <= to && from !== to;
          return (
            <span key={i} className={`flex h-10 items-center justify-center ${inRange ? "bg-accent/15" : ""} ${iso === from && inRange ? "rounded-l-full" : ""} ${iso === to && inRange ? "rounded-r-full" : ""}`}>
              <button
                type="button"
                disabled={off}
                aria-pressed={end}
                aria-label={iso}
                onClick={() => onTap(iso)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                  end ? "bg-accent font-bold text-on-accent" : iso === todayISO ? "border border-accent" : "hover:bg-ground"
                } disabled:text-muted disabled:opacity-40`}
              >
                {Number(iso.slice(8, 10))}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

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
 * Pause on the Workouts menu (v0.678; v0.684 a button like Edit plan): under
 * the label, "Until Nov 14" while one runs or "From Nov 20" for one ahead.
 */
export function WorkoutPauseButton({ userId, todayISO, onOpen }: { userId: string; todayISO: string; onOpen: () => void }) {
  const { pauses } = usePauses(userId);
  const first = pauses?.[0];
  const short = (iso: string) => `${MONTH[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
  const sub = first ? (first.from > todayISO ? `From ${short(first.from)}` : `Until ${short(first.to)}`) : undefined;
  return <ActionButton icon={PauseIcon} label="Pause" sub={sub} onClick={onOpen} />;
}

/**
 * Pause workouts, a full page (v0.680): household pauses (from Admin) and the
 * person's own, each of theirs with End or Remove; a new one with a reason
 * and its exact first and last day, so one can be planned ahead.
 */
export function WorkoutPausePage({ userId, todayISO, onBack }: { userId: string; todayISO: string; onBack: () => void }) {
  const { pauses, setPauses } = usePauses(userId);
  const [reason, setReason] = useState("SICK");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<WorkoutPauseInfo[]>) =>
    start(async () => {
      try {
        setPauses(await fn());
      } catch {
        /* stays as it was */
      }
    });
  const tap = (iso: string) => {
    if (!from || to) {
      setFrom(iso);
      setTo(null);
    } else if (iso < from) setFrom(iso);
    else setTo(iso > addDays(from, 179) ? addDays(from, 179) : iso);
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
                  {p.kind === "household" ? " · household" : p.kind === "admin" ? " · set by a parent" : ""}
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
        <RangeCalendar from={from} to={to} todayISO={todayISO} onTap={tap} />
        <p className="text-sm font-semibold">
          {!from
            ? "Tap the first day"
            : !to
              ? `${dayText(from)} → tap the last day`
              : `${dayText(from)} → ${dayText(to)} · ${daysBetween(from, to) + 1 === 1 ? "1 day" : `${daysBetween(from, to) + 1} days`}`}
        </p>
        <button
          type="button"
          disabled={pending || !from || !to}
          onClick={() => {
            if (!from || !to) return;
            save(() => startPersonalPause(userId, reason, from, to));
            setFrom(null);
            setTo(null);
          }}
          className={`${PRIMARY_BTN} w-full`}
        >
          {from && from > todayISO ? "Plan pause" : "Start pause"}
        </button>
      </div>
    </div>
  );
}
