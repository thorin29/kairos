"use client";

import { useState } from "react";
import { BandageIcon, CheckIcon } from "@/components/icons";
import { EFFORTS, EFFORT_LABEL, HURT_AREAS, HURT_LABEL, type Effort, type HurtArea } from "@/lib/workouts/catalog";

/**
 * "How did it feel?" for any workout (v0.618.1): a four-step slider (Easy,
 * Solid, Hard, Too hard) and a check to lock it in, plus a small bandage for
 * "something hurt". The answers feed the day suggestions (hard days → a
 * lighter day). Moving the slider after locking asks for the check again.
 */
export function EffortPicker({
  question,
  effort,
  hurt,
  onChange,
}: {
  question: string;
  effort: Effort | null;
  hurt: HurtArea | null;
  onChange: (effort: Effort | null, hurt: HurtArea | null) => void;
  /** Kept for older callers; the slider is one size. */
  compact?: boolean;
}) {
  const saved = effort ? EFFORTS.indexOf(effort) : -1;
  const [draft, setDraft] = useState<number | null>(null);
  const [hurtOpen, setHurtOpen] = useState(false);
  const value = draft ?? (saved >= 0 ? saved : 1);
  const unset = saved < 0 && draft == null;
  const locked = saved >= 0 && (draft == null || draft === saved);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">{question}</p>
        {hurt && <span className="text-xs font-semibold text-red-700">{HURT_LABEL[hurt]}</span>}
        <button
          type="button"
          aria-label={hurt ? `Hurt: ${HURT_LABEL[hurt]}` : "Something hurt?"}
          onClick={() => setHurtOpen(true)}
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            hurt ? "bg-red-50 text-red-700" : "text-muted hover:bg-ground hover:text-ink"
          }`}
        >
          <BandageIcon className="h-[18px] w-[18px]" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={EFFORTS.length - 1}
            step={1}
            value={value}
            data-unset={unset ? "true" : "false"}
            aria-label={question}
            aria-valuetext={EFFORT_LABEL[EFFORTS[value]]}
            onChange={(e) => setDraft(Number(e.target.value))}
            className="effort-range"
          />
          {/* Each label sits under its stop: the thumb's centre runs from
              15px in to 15px short of the end. */}
          <div className="relative h-4 text-xs">
            {EFFORTS.map((e, i) => (
              <button
                key={e}
                type="button"
                tabIndex={-1}
                onClick={() => setDraft(i)}
                style={{ left: `calc(15px + ${i / (EFFORTS.length - 1)} * (100% - 30px))` }}
                className={`absolute top-0 -translate-x-1/2 whitespace-nowrap ${
                  !unset && i === value ? "font-semibold text-accent" : "text-muted"
                }`}
              >
                {EFFORT_LABEL[e]}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-label={locked ? `Saved: ${EFFORT_LABEL[EFFORTS[saved]]}` : `Save: ${EFFORT_LABEL[EFFORTS[value]]}`}
          aria-pressed={locked}
          disabled={locked}
          onClick={() => {
            onChange(EFFORTS[value], hurt);
            setDraft(null);
          }}
          className={`mb-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${
            locked ? "border-accent bg-accent text-on-accent" : "border-accent text-accent hover:bg-accent/10"
          }`}
        >
          <CheckIcon className="h-5 w-5" />
        </button>
      </div>

      {hurtOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onClick={() => setHurtOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Something hurt?"
            className="w-full max-w-sm rounded-t-2xl bg-surface p-4 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-base font-semibold">Something hurt?</p>
            <div className="flex flex-wrap gap-2">
              {HURT_AREAS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={hurt === a}
                  onClick={() => {
                    onChange(effort, a);
                    setHurtOpen(false);
                  }}
                  className={`inline-flex h-10 items-center rounded-full border px-3.5 text-sm font-medium ${
                    hurt === a ? "border-red-300 bg-red-50 text-red-700" : "border-hairline hover:border-accent"
                  }`}
                >
                  {HURT_LABEL[a]}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {hurt && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(effort, null);
                    setHurtOpen(false);
                  }}
                  className="h-10 px-3 text-sm font-semibold text-accent hover:underline"
                >
                  Nothing hurt
                </button>
              )}
              <button type="button" onClick={() => setHurtOpen(false)} className="h-10 px-3 text-sm text-muted hover:text-ink">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
