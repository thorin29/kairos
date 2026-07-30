"use client";

import { useState, useTransition } from "react";
import { completePlannedWorkout } from "@/lib/actions/workouts";
import { CheckIcon } from "@/components/icons";
import {
  METRIC_LABEL_SHORT,
  defaultMetricFor,
  metricUnit,
  type Metric,
  type UnitSystem,
  type WorkoutCategory,
} from "@/lib/workouts/catalog";
import type { PersonWorkout, PlanWorkout } from "@/lib/queries/workouts";

/**
 * Today's scheduled workouts, each completable straight from the plan: tapping
 * one asks only for the metrics it was set to track (pulled from the pool), and
 * completing it logs the session and marks the day done. Replaces the old
 * "mark done" toggle and the per-person "add a lift" panel — everything logs
 * against the shared pool now.
 */
export function TodayPlan({
  person,
  todayISO,
  todayDow,
  unitSystem,
}: {
  person: PersonWorkout;
  todayISO: string;
  todayDow: number;
  unitSystem: UnitSystem;
}) {
  const todays = person.plan[todayDow]?.workouts ?? [];
  const doneLabels = new Set(
    person.todayWorkouts.map((w) => w.label.trim().toLowerCase()),
  );

  return (
    <div>
      <p className="mb-2 font-display text-sm font-semibold">Today&rsquo;s plan</p>

      {person.today.rested ? (
        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
          Rest day taken.
        </p>
      ) : todays.length === 0 ? (
        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
          Nothing scheduled today. Log something else below.
        </p>
      ) : (
        <div className="space-y-2">
          {todays.map((w) => (
            <PlanRow
              key={w.id}
              workout={w}
              userId={person.user.id}
              todayISO={todayISO}
              unitSystem={unitSystem}
              done={doneLabels.has(w.name.trim().toLowerCase())}
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
  todayISO,
  unitSystem,
  done,
}: {
  workout: PlanWorkout;
  userId: string;
  todayISO: string;
  unitSystem: UnitSystem;
  done: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const category: WorkoutCategory = workout.category ?? "WEIGHTS";
  const trackedExercises = workout.exercises.filter((e) => e.tracked);
  const untracked = workout.exercises.filter((e) => !e.tracked);
  const metricOnly = workout.exercises.length === 0;
  const soloMetric = defaultMetricFor(category);

  const metricFor = (m: Metric | null): Metric => m ?? defaultMetricFor(category);

  const setVal = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v.replace(/[^\d.]/g, "") }));

  const complete = () => {
    const entries: {
      poolExerciseId: string | null;
      metric: Metric;
      value: number;
      unit: string;
    }[] = [];

    const push = (poolExerciseId: string | null, metric: Metric, raw: string) => {
      const num = Number(raw);
      if (!raw || !Number.isFinite(num) || num <= 0) return;
      const value = metric === "DURATION" ? num * 60 : num;
      entries.push({
        poolExerciseId,
        metric,
        value,
        unit: metric === "DURATION" ? "" : metricUnit(metric, unitSystem),
      });
    };

    if (metricOnly) {
      push(null, soloMetric, values["_solo"] ?? "");
    } else {
      for (const e of trackedExercises) {
        push(e.poolExerciseId, metricFor(e.metric), values[e.id] ?? "");
      }
    }

    startTransition(async () => {
      await completePlannedWorkout({
        userId,
        dateISO: todayISO,
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
          {workout.exercises.length > 0 ? (
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
          {metricOnly ? (
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
                return (
                  <MetricField
                    key={e.id}
                    label={e.name}
                    metric={m}
                    unit={metricUnit(m, unitSystem)}
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
}: {
  label: string;
  metric: Metric;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-[8rem] flex-1 text-sm font-medium">{label}</span>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={METRIC_LABEL_SHORT[metric].toLowerCase()}
          className="tabular h-9 w-20 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
        />
        {unit}
      </label>
    </div>
  );
}
