"use client";

import { useState, useTransition } from "react";
import { completePlannedWorkout, logHiitWorkout } from "@/lib/actions/workouts";
import { CheckIcon } from "@/components/icons";
import {
  METRIC_LABEL_SHORT,
  WORKOUT_TYPE_LABEL,
  formatHiitMovement,
  defaultMetricFor,
  hiitResult,
  metricUnit,
  type Metric,
  type UnitSystem,
  type WorkoutCategory,
} from "@/lib/workouts/catalog";
import type { PlanWorkout } from "@/lib/queries/workouts";

/**
 * A day's scheduled workouts, each completable straight from the plan: tapping
 * one asks only for the metrics it was set to track (pulled from the pool), and
 * completing it logs the session against `dateISO` and marks that day done.
 * Date-driven so it serves both today (on the board) and a carried-over day
 * opened from someone's dashboard.
 */
export function TodayPlan({
  userId,
  dateISO,
  workouts,
  doneLabels,
  paused,
  rested,
  unitSystem,
  heading = "Today\u2019s plan",
}: {
  userId: string;
  dateISO: string;
  workouts: PlanWorkout[];
  doneLabels: string[];
  paused: string | null;
  rested: boolean;
  unitSystem: UnitSystem;
  heading?: string;
}) {
  const todays = paused ? [] : workouts.filter((w) => !w.isRest);
  const done = new Set(doneLabels.map((l) => l.trim().toLowerCase()));

  return (
    <div>
      <p className="mb-2 font-display text-sm font-semibold">{heading}</p>

      {paused ? (
        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
          Workouts are paused for {paused}. Nothing&rsquo;s due &mdash; log
          something below if you want to keep track.
        </p>
      ) : rested ? (
        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
          Rest day taken.
        </p>
      ) : todays.length === 0 ? (
        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
          Nothing scheduled. Log something else below.
        </p>
      ) : (
        <div className="space-y-2">
          {todays.map((w) => (
            <PlanRow
              key={w.id}
              workout={w}
              userId={userId}
              dateISO={dateISO}
              unitSystem={unitSystem}
              done={done.has(w.name.trim().toLowerCase())}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanRow({
  workout,
  userId,
  dateISO,
  unitSystem,
  done,
}: {
  workout: PlanWorkout;
  userId: string;
  dateISO: string;
  unitSystem: UnitSystem;
  done: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const category: WorkoutCategory = workout.category ?? "WEIGHTS";
  const hiit = workout.hiit;
  const trackedExercises = workout.exercises.filter((e) => e.tracked);
  const untracked = workout.exercises.filter((e) => !e.tracked);
  const metricOnly = workout.exercises.length === 0;
  const soloMetric = defaultMetricFor(category);

  const metricFor = (m: Metric | null): Metric => m ?? defaultMetricFor(category);

  const setVal = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v.replace(/[^\d.]/g, "") }));

  const complete = () => {
    // A named HIIT workout logs a single result via logHiitWorkout.
    if (hiit) {
      const r = hiitResult(hiit.type);
      const value =
        r.metric === "DURATION"
          ? (Number(values["_min"] || 0) * 60 + Number(values["_sec"] || 0))
          : Number(values["_count"] || 0);
      if (!(value > 0)) return;
      startTransition(async () => {
        await logHiitWorkout({
          userId,
          dateISO,
          hiitWorkoutId: hiit.id,
          value,
        });
        setOpen(false);
      });
      return;
    }

    const entries: {
      poolExerciseId: string | null;
      metric: Metric;
      value: number;
      unit: string;
    }[] = [];

    const push = (
      poolExerciseId: string | null,
      metric: Metric,
      raw: string,
      unit: string,
    ) => {
      const num = Number(raw);
      if (!raw || !Number.isFinite(num) || num <= 0) return;
      const value = metric === "DURATION" ? num * 60 : num;
      entries.push({ poolExerciseId, metric, value, unit });
    };

    const resolveUnit = (m: Metric, exUnit?: string): string =>
      m === "DURATION"
        ? ""
        : m === "WEIGHT" && exUnit
          ? exUnit
          : metricUnit(m, unitSystem);

    if (metricOnly) {
      push(null, soloMetric, values["_solo"] ?? "", resolveUnit(soloMetric));
    } else {
      for (const e of trackedExercises) {
        const m = metricFor(e.metric);
        push(e.poolExerciseId, m, values[e.id] ?? "", resolveUnit(m, e.unit));
      }
    }

    startTransition(async () => {
      await completePlannedWorkout({
        userId,
        dateISO,
        plannedWorkoutId: workout.id,
        entries,
      });
      setOpen(false);
    });
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2.5">
        <CheckIcon className="h-4 w-4 shrink-0 text-accent" />
        <span className="text-sm font-medium">{workout.name}</span>
        <span className="ml-auto text-xs text-accent">Logged</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline bg-ground/30 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{workout.name}</div>
          {hiit ? (
            <div className="mt-0.5 text-xs text-muted">
              {WORKOUT_TYPE_LABEL[hiit.type]}
              {hiit.movements.length > 0 &&
                ` · ${hiit.movements
                  .map((m) => formatHiitMovement(m))
                  .join(", ")}`}
            </div>
          ) : workout.exercises.length > 0 ? (
            <div className="mt-0.5 text-xs text-muted">
              {workout.exercises.map((e) => e.name).join(" · ")}
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-muted">
              Log {METRIC_LABEL_SHORT[soloMetric].toLowerCase()}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-accent"
        >
          {open ? "Cancel" : "Complete"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-hairline pt-3">
          {hiit ? (
            <div>
              <span className="mb-1 block text-sm font-medium">
                {hiitResult(hiit.type).label}
              </span>
              {hiitResult(hiit.type).metric === "DURATION" ? (
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    value={values["_min"] ?? ""}
                    onChange={(e) => setVal("_min", e.target.value)}
                    placeholder="0"
                    className="tabular h-9 w-16 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                  />
                  <span className="text-xs text-muted">min</span>
                  <input
                    inputMode="numeric"
                    value={values["_sec"] ?? ""}
                    onChange={(e) => setVal("_sec", e.target.value)}
                    placeholder="00"
                    className="tabular h-9 w-16 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                  />
                  <span className="text-xs text-muted">sec</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    value={values["_count"] ?? ""}
                    onChange={(e) => setVal("_count", e.target.value)}
                    placeholder="0"
                    className="tabular h-9 w-20 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                  />
                  <span className="text-xs text-muted">
                    {hiit.type === "AMRAP" ? "rounds" : "reps"}
                  </span>
                </div>
              )}
            </div>
          ) : metricOnly ? (
            <MetricField
              label={workout.name}
              metric={soloMetric}
              unit={metricUnit(soloMetric, unitSystem)}
              value={values["_solo"] ?? ""}
              onChange={(v) => setVal("_solo", v)}
            />
          ) : (
            <>
              {trackedExercises.map((e) => {
                const m = metricFor(e.metric);
                const unit =
                  m === "WEIGHT"
                    ? e.unit || metricUnit(m, unitSystem)
                    : metricUnit(m, unitSystem);
                return (
                  <MetricField
                    key={e.id}
                    label={e.name}
                    metric={m}
                    unit={unit}
                    hint={m === "WEIGHT" ? "today's max" : undefined}
                    value={values[e.id] ?? ""}
                    onChange={(v) => setVal(e.id, v)}
                  />
                );
              })}
              {untracked.length > 0 && (
                <p className="text-xs text-muted">
                  No log needed: {untracked.map((e) => e.name).join(", ")}
                </p>
              )}
              {trackedExercises.length === 0 && (
                <p className="text-xs text-muted">
                  Nothing to log for this one — just mark it complete.
                </p>
              )}
            </>
          )}

          <button
            type="button"
            onClick={complete}
            disabled={pending}
            className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm hover:shadow-md disabled:opacity-40"
          >
            <CheckIcon className="h-4 w-4" />
            {pending ? "Completing…" : "Complete workout"}
          </button>
        </div>
      )}
    </div>
  );
}

function MetricField({
  label,
  metric,
  unit,
  value,
  onChange,
  hint,
}: {
  label: string;
  metric: Metric;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-[8rem] flex-1 text-sm font-medium">
        {label}
        {hint && <span className="ml-1 text-xs font-normal text-muted">({hint})</span>}
      </span>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hint ?? METRIC_LABEL_SHORT[metric].toLowerCase()}
          className="tabular h-9 w-20 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
        />
        {unit}
      </label>
    </div>
  );
}
