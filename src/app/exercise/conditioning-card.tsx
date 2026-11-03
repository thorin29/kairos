"use client";

import { SECONDARY_BTN } from "./buttons";
import { useState, useTransition } from "react";
import { EffortPicker } from "@/components/effort-picker";
import { logHiitWorkout, saveMovementFeedback, skipMovement } from "@/lib/actions/workouts";
import { WORKOUT_TYPE_LABEL, type Effort, type HurtArea } from "@/lib/workouts/catalog";
import { clockText, timerPlanFor } from "@/lib/workouts/timer";
import type { ConditioningPlan } from "@/lib/workouts/conditioning-run";
import { ConditioningTimer } from "./conditioning-timer";
import { VersionToggle } from "./conditioning-picker";

/**
 * A planned conditioning workout on the day page (the mockup's "Planned"):
 * what it is, the result to beat, Start (the timer), logging without the
 * timer, Skip, and how it felt once logged.
 */
export function ConditioningCard({
  userId,
  dateISO,
  workout,
  skipped,
  onChanged,
}: {
  userId: string;
  dateISO: string;
  workout: ConditioningPlan;
  skipped: boolean;
  onChanged: () => void;
}) {
  const [timing, setTiming] = useState(false);
  const [manual, setManual] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [effort, setEffort] = useState<Effort | null>((workout.effort as Effort | null) ?? null);
  const [hurt, setHurt] = useState<HurtArea | null>((workout.hurt as HurtArea | null) ?? null);
  const [pending, start] = useTransition();
  const [version, setVersion] = useState<"RX" | "SCALED">(workout.scaled ? workout.version : "RX");
  const movements = version === "SCALED" && workout.scaled ? workout.scaled : workout.movements;
  const plan = timerPlanFor(workout.type, workout.capSec, movements.map((m) => m.name));
  const isTime = workout.resultMetric === "DURATION";

  const log = async (v: number, notes: string) => {
    await logHiitWorkout({
      userId,
      dateISO,
      hiitWorkoutId: workout.hiitWorkoutId,
      value: v,
      notes: notes || undefined,
      replace: true,
      version: workout.scaled ? version : null,
    });
    setTiming(false);
    setManual(false);
    setValue("");
    onChanged();
  };

  const saveManual = () => {
    let v: number | null = null;
    if (isTime) {
      const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(value.trim());
      v = m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
    } else {
      const n = Number(value);
      v = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    }
    if (!v) {
      setError(isTime ? "Time as mm:ss." : `Enter the ${workout.resultLabel.toLowerCase()}.`);
      return;
    }
    setError("");
    start(() => log(v as number, ""));
  };

  const meta = [
    workout.today ? `Today: ${workout.today}` : null,
    workout.last ? `Your last: ${workout.last}` : null,
    workout.best ? `Household best: ${workout.best.name} ${workout.best.result}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-surface px-4 py-3">
      <div>
        <p className="text-base font-semibold">{workout.name}</p>
        <p className="text-sm text-muted">
          {WORKOUT_TYPE_LABEL[workout.type]}
          {plan.totalSec ? ` · ${clockText(plan.totalSec)}` : ""}
        </p>
      </div>
      {workout.about && <p className="text-sm text-muted">{workout.about}</p>}
      {workout.scaled && <VersionToggle value={version} onChange={setVersion} />}
      {movements.length > 0 && (
        <ul className="space-y-0.5 text-sm">
          {movements.map((m, i) => (
            <li key={i}>{m.line}</li>
          ))}
        </ul>
      )}
      {meta.length > 0 && <p className="text-xs text-muted">{meta.join(" · ")}</p>}

      {workout.today ? (
        <EffortPicker
          compact
          question="How did it feel?"
          effort={effort}
          hurt={hurt}
          onChange={(e, h) => {
            setEffort(e);
            setHurt(h);
            void saveMovementFeedback({ userId, dateISO, slot: `hiit:${workout.plannedWorkoutId}`, effort: e, hurt: h }).catch(
              () => undefined,
            );
          }}
        />
      ) : null}

      {manual && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            {workout.resultLabel}
            <input
              autoFocus
              value={value}
              inputMode="numeric"
              onChange={(e) => setValue(e.target.value.replace(/[^\d:]/g, ""))}
              placeholder={isTime ? "mm:ss" : "0"}
              className="tabular h-10 w-24 rounded-xl border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={saveManual}
            className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40"
          >
            Save
          </button>
          <button type="button" onClick={() => setManual(false)} className="h-10 px-2 text-sm text-muted hover:text-ink">
            Cancel
          </button>
          {error && <p className="w-full text-sm text-red-700">{error}</p>}
        </div>
      )}

      {!manual && (
        <div className="flex flex-wrap items-center gap-2">
          {!skipped && (
            <button
              type="button"
              onClick={() => {
                // Logging from the timer replaces today's result: ask first.
                if (
                  workout.today &&
                  !confirm(`You already logged ${workout.today} today. A new result from the timer will replace it. Start the timer?`)
                )
                  return;
                setTiming(true);
              }}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent"
            >
              {workout.today ? "Start again" : "Start"}
            </button>
          )}
          {!skipped && (
            <button
              type="button"
              onClick={() => setManual(true)}
              className={SECONDARY_BTN}
            >
              {workout.today ? "Edit result" : "Log a result"}
            </button>
          )}
          {!workout.today && (
            <button
              type="button"
              aria-pressed={skipped}
              onClick={() =>
                start(async () => {
                  await skipMovement({ userId, dateISO, plannedWorkoutId: workout.plannedWorkoutId, poolExerciseId: "", skipped: !skipped });
                  onChanged();
                })
              }
              className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${
                skipped ? "border-hairline bg-ground text-muted" : "border-hairline text-muted hover:border-accent"
              }`}
            >
              {skipped ? "Skipped" : "Skip"}
            </button>
          )}
        </div>
      )}

      {timing && (
        <ConditioningTimer
          userId={userId}
          workout={{ ...workout, movements }}
          lastText={workout.last}
          onLog={log}
          onClose={() => setTiming(false)}
        />
      )}
    </div>
  );
}
