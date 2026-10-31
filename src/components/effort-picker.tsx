"use client";

import { useState } from "react";
import { EFFORTS, EFFORT_LABEL, HURT_AREAS, HURT_LABEL, type Effort, type HurtArea } from "@/lib/workouts/catalog";

/**
 * "How did it feel?" (Easy / Solid / Hard / Too hard) and "Something hurt?",
 * for a cardio entry or a sport event. The answers feed the day suggestions
 * (hard days → a lighter day). Tapping the chosen answer again clears it.
 */
export function EffortPicker({
  question,
  effort,
  hurt,
  onChange,
  compact = false,
}: {
  question: string;
  effort: Effort | null;
  hurt: HurtArea | null;
  onChange: (effort: Effort | null, hurt: HurtArea | null) => void;
  compact?: boolean;
}) {
  const [hurtOpen, setHurtOpen] = useState(false);
  const h = compact ? "h-9 px-3" : "h-11 px-4";
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{question}</p>
      <div className="flex flex-wrap gap-2">
        {EFFORTS.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={effort === e}
            onClick={() => onChange(effort === e ? null : e, hurt)}
            className={`inline-flex ${h} items-center rounded-full border text-sm font-semibold transition-colors ${
              effort === e ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
            }`}
          >
            {EFFORT_LABEL[e]}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={hurtOpen}
          onClick={() => setHurtOpen((v) => !v)}
          className={`inline-flex ${h} items-center rounded-full border text-sm font-semibold ${
            hurt ? "border-red-200 bg-red-50 text-red-700" : "border-hairline text-muted hover:border-accent"
          }`}
        >
          {hurt ? `Hurt: ${HURT_LABEL[hurt].toLowerCase()}` : "Something hurt?"}
        </button>
      </div>
      {hurtOpen && (
        <div className="flex flex-wrap gap-2">
          {HURT_AREAS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={hurt === a}
              onClick={() => {
                onChange(effort, hurt === a ? null : a);
                setHurtOpen(false);
              }}
              className={`inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium ${
                hurt === a ? "border-red-300 bg-red-50 text-red-700" : "border-hairline hover:border-accent"
              }`}
            >
              {HURT_LABEL[a]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
