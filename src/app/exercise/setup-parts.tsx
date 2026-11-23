"use client";

import { PRIMARY_BTN, SECONDARY_BTN } from "./buttons";
import type { WarmupRoutine } from "@/lib/workouts/warmup-library";

/**
 * The pieces every program setup shares (v0.747), so the classic programs and
 * Odd squad look and step the same: the step header, weekday chips, the
 * Warm-up / Cardio / Conditioning step (each can be left out) and the
 * Back / Next bar.
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

/** Warm-up ("none", "" a plain check, or a routine), cardio days and
 *  conditioning days. Any of them can be left out. */
export function ExtrasStep({
  warmups,
  warmup,
  onWarmup,
  cardioDays,
  onCardio,
  conditioningDays,
  onConditioning,
}: {
  warmups: WarmupRoutine[];
  warmup: string;
  onWarmup: (v: string) => void;
  cardioDays: number[];
  onCardio: (days: number[]) => void;
  conditioningDays: number[];
  onConditioning: (days: number[]) => void;
}) {
  return (
    <div className="space-y-5">
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
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Cardio</p>
        <DayChips label="Cardio" value={cardioDays} onToggle={(d) => onCardio(toggleDay(cardioDays, d))} />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Conditioning</p>
        <DayChips label="Conditioning" value={conditioningDays} onToggle={(d) => onConditioning(toggleDay(conditioningDays, d))} />
      </div>
    </div>
  );
}

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
