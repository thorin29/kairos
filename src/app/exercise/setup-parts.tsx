"use client";

import { PRIMARY_BTN, SECONDARY_BTN } from "./buttons";
import type { WarmupRoutine } from "@/lib/workouts/warmup-library";
import { MUSCLE_GROUP_LABEL, type MuscleGroup } from "@/lib/workouts/catalog";
import { OTHER_ADDS, OTHER_LABEL, STRENGTH_GROUPS, joinOther, splitOther } from "@/lib/workouts/other-days";
import { useEffect, useState } from "react";
import { Modal } from "./plan-file-panel";
import { CoreRotationPicker } from "./core-days";
import { listExercisePool, loadWarmupRoutines } from "@/lib/actions/workouts";
import type { PoolEntry } from "@/lib/queries/workouts";

/**
 * The pieces every program setup shares (v0.747), so the classic programs and
 * Odd squad look and step the same (v0.748): the step header, weekday chips,
 * Other days, Warm-up, Cardio and Finishers (each can be left out), the
 * week to review, and the Back / Next bar.
 */

export const SETUP_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SELECT = "h-10 min-w-0 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent";

/** Bars, then "2 of 5 · Lifts". */
export function StepHeader({ steps, step }: { steps: readonly string[]; step: number }) {
  return (
    <div>
      <ol className="flex gap-1" aria-label="Steps">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-hairline"}`}
          />
        ))}
      </ol>
      <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted">
        {step + 1} of {steps.length} · {steps[step]}
      </p>
    </div>
  );
}

export function DayChips({ value, onToggle, label }: { value: number[]; onToggle: (d: number) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {SETUP_WEEKDAYS.map((w, d) => (
        <button
          key={w}
          type="button"
          aria-pressed={value.includes(d)}
          onClick={() => onToggle(d)}
          className={`h-10 w-12 rounded-full border text-sm font-semibold ${
            value.includes(d) ? "border-accent bg-accent text-on-accent" : "border-hairline bg-surface hover:border-accent"
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  );
}

export const toggleDay = (list: number[], d: number) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort());

/** Back (from the second step) and Next, or the last step's button. */
export function StepBar({
  step,
  steps,
  onStep,
  canNext = true,
  last,
}: {
  step: number;
  steps: readonly string[];
  onStep: (n: number) => void;
  canNext?: boolean;
  last: { label: string; busy: boolean; onClick: () => void };
}) {
  return (
    <div className="sticky -bottom-4 -mx-4 flex gap-2 bg-ground px-4 py-3">
      {step > 0 && (
        <button type="button" onClick={() => onStep(step - 1)} className={`${SECONDARY_BTN} flex-1 justify-center`}>
          Back
        </button>
      )}
      {step < steps.length - 1 ? (
        <button type="button" disabled={!canNext} onClick={() => onStep(step + 1)} className={`${PRIMARY_BTN} flex-1 justify-center`}>
          Next
        </button>
      ) : (
        <button type="button" disabled={last.busy} onClick={last.onClick} className={`${PRIMARY_BTN} flex-1 justify-center`}>
          {last.label}
        </button>
      )}
    </div>
  );
}

/** Monday first, for the weekday lists. */
export const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

const CHIP_ON = "border-accent bg-accent text-on-accent";
const CHIP_OFF = "border-hairline bg-surface hover:border-accent";
function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-full border px-3 text-sm font-semibold ${on ? CHIP_ON : CHIP_OFF}`}
    >
      {label}
    </button>
  );
}

/** A kind's words: "Core", "Strength · Legs", "As it is". */
export function otherWords(raw: string): string {
  const kind = splitOther(raw).kind;
  if (kind.startsWith("strength:")) return `Strength · ${MUSCLE_GROUP_LABEL[kind.slice(9) as MuscleGroup] ?? ""}`;
  return OTHER_LABEL[kind] ?? kind;
}

/**
 * Other days (v0.748): each weekday the program doesn't use is Rest, Skip or
 * something added. "As it is" shows for a day built by hand, kept while
 * picked.
 */
export function OtherDaysStep({
  programDays,
  other,
  onChange,
  had,
  userId,
}: {
  programDays: number[];
  other: Record<number, string>;
  onChange: (day: number, kind: string) => void;
  /** What each weekday holds now (Sunday first), for "As it is". */
  had?: string[];
  /** With it, picking an add opens that kind's window (v0.753). */
  userId?: string;
}) {
  const [win, setWin] = useState<{ day: number; raw: string } | null>(null);
  const open = MONDAY_FIRST.filter((d) => !programDays.includes(d));
  if (open.length === 0) return <p className="text-sm text-muted">Every day has the program.</p>;
  const pickAdd = (d: number, raw: string) => {
    onChange(d, raw);
    if (userId && hasWindow(splitOther(raw).kind)) setWin({ day: d, raw });
  };
  return (
    <div className="divide-y divide-hairline">
      {open.map((d) => {
        const raw = other[d] ?? "skip";
        const k = splitOther(raw).kind;
        const picked = splitOther(raw).ids.length;
        const added = k !== "rest" && k !== "skip";
        const custom = had?.[d] === "custom";
        return (
          <div key={d} className="space-y-2 py-2.5 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-10 text-sm font-semibold">{SETUP_WEEKDAYS[d]}</span>
              <Chip on={k === "rest"} label="Rest" onClick={() => onChange(d, "rest")} />
              <Chip on={k === "skip"} label="Skip" onClick={() => onChange(d, "skip")} />
              <Chip on={added} label="Add" onClick={() => onChange(d, custom ? "custom" : "core")} />
            </div>
            {added && (
              <div className="flex flex-wrap gap-1.5 pl-12">
                {custom && <Chip on={k === "custom"} label={OTHER_LABEL.custom} onClick={() => onChange(d, "custom")} />}
                {OTHER_ADDS.map((a) => (
                  <Chip
                    key={a}
                    on={a === "strength" ? k.startsWith("strength:") : k === a}
                    label={OTHER_LABEL[a]}
                    onClick={() =>
                      (a === "strength" ? k.startsWith("strength:") : k === a) && userId && hasWindow(k)
                        ? setWin({ day: d, raw })
                        : pickAdd(d, a === "strength" ? "strength:CHEST" : a)
                    }
                  />
                ))}
                {k.startsWith("strength:") && !userId && (
                  <select
                    aria-label={`${SETUP_WEEKDAYS[d]} muscle group`}
                    value={k.slice(9)}
                    onChange={(e) => onChange(d, `strength:${e.target.value}`)}
                    className={SELECT}
                  >
                    {STRENGTH_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {MUSCLE_GROUP_LABEL[g as MuscleGroup]}
                      </option>
                    ))}
                  </select>
                )}
                {userId && hasWindow(k) && (
                  <button type="button" onClick={() => setWin({ day: d, raw })} className="h-8 px-1 text-sm font-semibold text-accent">
                    {picked ? `${otherWords(k)} · ${picked} picked` : "Choose"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {win && userId && (
        <OtherDayWindow
          userId={userId}
          day={win.day}
          raw={win.raw}
          onClose={() => setWin(null)}
          onDone={(v) => {
            onChange(win.day, v);
            setWin(null);
          }}
        />
      )}
    </div>
  );
}

const hasWindow = (k: string) => ["core", "arms", "iso", "mobility", "stretching"].includes(k) || k.startsWith("strength:");

/**
 * An added other day's own window (v0.753): the Core, Arms or Isometric
 * workouts to rotate (with the monthly test), a Mobility or Stretching
 * routine, or a muscle group and its movements. Done sends them with the
 * day; Back keeps the day as it was.
 */
function OtherDayWindow({
  userId,
  day,
  raw,
  onClose,
  onDone,
}: {
  userId: string;
  day: number;
  raw: string;
  onClose: () => void;
  onDone: (raw: string) => void;
}) {
  const start = splitOther(raw);
  const kind = start.kind;
  const rot = kind === "core" || kind === "arms" || kind === "iso";
  const [ids, setIds] = useState<string[]>(start.ids);
  const [test, setTest] = useState(start.test ?? kind !== "arms");
  const [group, setGroup] = useState(kind.startsWith("strength:") ? kind.slice(9) : "CHEST");
  const [pool, setPool] = useState<PoolEntry[] | null>(null);
  const [routines, setRoutines] = useState<{ id: string; name: string }[] | null>(null);
  useEffect(() => {
    if (kind === "mobility" || kind === "stretching") {
      loadWarmupRoutines(userId, kind)
        .then((r) => setRoutines(r.map((x) => ({ id: x.id, name: x.name }))))
        .catch(() => setRoutines([]));
    } else {
      listExercisePool()
        .then(setPool)
        .catch(() => setPool([]));
    }
  }, [userId, kind]);
  const toggle = (id: string) => setIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const done = () => {
    if (rot) onDone(joinOther(kind, ids, kind === "arms" ? null : test));
    else if (kind.startsWith("strength:")) onDone(joinOther(`strength:${group}`, ids));
    else onDone(joinOther(kind, ids.slice(0, 1)));
  };
  const moves = (pool ?? []).filter((p) => p.isActive && p.category === "WEIGHTS" && p.muscleGroup === group);
  return (
    <Modal title={`${SETUP_WEEKDAYS[day]} · ${otherWords(kind)}`} onClose={onClose}>
      <div className="space-y-3">
        {rot ? (
          pool ? (
            <CoreRotationPicker userId={userId} pool={pool} rotation={ids} onRotation={setIds} test={test} onTest={setTest} kind={kind} />
          ) : (
            <p className="text-sm text-muted">Loading…</p>
          )
        ) : kind.startsWith("strength:") ? (
          <>
            <select aria-label="Muscle group" value={group} onChange={(e) => { setGroup(e.target.value); setIds([]); }} className={SELECT}>
              {STRENGTH_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {MUSCLE_GROUP_LABEL[g as MuscleGroup]}
                </option>
              ))}
            </select>
            {!pool ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {moves.map((m) => {
                  const n = ids.indexOf(m.id);
                  return (
                    <li key={m.id}>
                      <button type="button" onClick={() => toggle(m.id)} aria-pressed={n >= 0} className="flex w-full items-center gap-3 py-2 text-left">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${n >= 0 ? "border-accent bg-accent text-on-accent" : "border-accent text-accent"}`}>
                          {n >= 0 ? n + 1 : ""}
                        </span>
                        <span className="text-sm font-semibold">{m.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : !routines ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {routines.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setIds([r.id])} aria-pressed={ids[0] === r.id} className="flex w-full items-center gap-3 py-2 text-left">
                  <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${ids[0] === r.id ? "border-accent bg-accent" : "border-hairline"}`} />
                  <span className="text-sm font-semibold">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={`${SECONDARY_BTN} flex-1 justify-center`}>
            Back
          </button>
          <button type="button" onClick={done} className={`${PRIMARY_BTN} flex-1 justify-center`}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Warm-up: None, a plain check, or a routine, on every workout day. */
export function WarmupStep({ warmups, warmup, onWarmup }: { warmups: WarmupRoutine[]; warmup: string; onWarmup: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">Warm-up</span>
      <select aria-label="Warm-up" value={warmup} onChange={(e) => onWarmup(e.target.value)} className={`${SELECT} max-w-[60%]`}>
        <option value="none">None</option>
        <option value="">Just a check</option>
        {warmups.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Days with cardio; none leaves it out. */
export function CardioStep({ days, onDays }: { days: number[]; onDays: (d: number[]) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">Cardio days</p>
      <DayChips label="Cardio" value={days} onToggle={(d) => onDays(toggleDay(days, d))} />
    </div>
  );
}

/** Finishers: conditioning days (picked on the day); none leaves it out. */
export function FinishersStep({ days, onDays }: { days: number[]; onDays: (d: number[]) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">Conditioning</p>
      <DayChips label="Conditioning" value={days} onToggle={(d) => onDays(toggleDay(days, d))} />
    </div>
  );
}

/** The week before Start: each weekday and what's on it. */
export function ReviewWeek({ days }: { days: { day: number; parts: string[] }[] }) {
  return (
    <div className="divide-y divide-hairline rounded-xl border border-hairline bg-surface px-3.5">
      {MONDAY_FIRST.map((d) => {
        const parts = days.find((x) => x.day === d)?.parts ?? [];
        return (
          <div key={d} className="flex gap-3 py-2 text-sm">
            <span className="w-10 font-semibold">{SETUP_WEEKDAYS[d]}</span>
            <span className={parts.length ? "" : "text-muted"}>{parts.length ? parts.join(" · ") : "Nothing"}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The other days to start from: the same program keeps what each day holds;
 *  a new one keeps the rest days only. */
export function startOther(had: string[] | undefined, same: boolean): Record<number, string> {
  const out: Record<number, string> = {};
  (had ?? []).forEach((k, d) => {
    out[d] = same ? k : k === "rest" ? "rest" : "skip";
  });
  return out;
}

/** What the setup sends: the other days only, cardio and conditioning days
 *  picked there added to those steps' days. */
export function otherPayload(
  programDays: number[],
  other: Record<number, string>,
  cardio: number[],
  conditioning: number[],
): { other: Record<string, string>; cardioDays: number[]; conditioningDays: number[] } {
  const out: Record<string, string> = {};
  for (let d = 0; d < 7; d++) if (!programDays.includes(d)) out[String(d)] = other[d] ?? "skip";
  const pick = (k: string) => Object.entries(out).filter(([, v]) => v === k).map(([d]) => Number(d));
  return {
    other: out,
    cardioDays: [...new Set([...cardio, ...pick("cardio")])].sort(),
    conditioningDays: [...new Set([...conditioning, ...pick("conditioning")])].sort(),
  };
}
