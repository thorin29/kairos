"use client";

import { useState, useTransition } from "react";
import { completePlannedWorkout, logHiitWorkout } from "@/lib/actions/workouts";
import { CheckIcon } from "@/components/icons";
import {
  METRIC_LABEL_SHORT,
  MUSCLE_GROUP_LABEL,
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

// Verb-noun for the log button, so it reads "Log weight" / "Log time" rather
// than a generic "Complete workout".
const LOG_NOUN: Record<Metric, string> = {
  WEIGHT: "weight",
  DISTANCE: "distance",
  METERS: "meters",
  DURATION: "time",
  REPS: "reps",
};

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
  loggedByPool = {},
}: {
  userId: string;
  dateISO: string;
  workouts: PlanWorkout[];
  doneLabels: string[];
  paused: string | null;
  rested: boolean;
  unitSystem: UnitSystem;
  heading?: string;
  /** Already-logged weights for this date, keyed by pool-exercise id. */
  loggedByPool?: Record<string, string>;
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
          Nothing scheduled. Log an additional workout below.
        </p>
      ) : (
        <div className="space-y-2">
          {groupByMuscle(todays).map((group) => {
            const row = (w: PlanWorkout, bare: boolean) => (
              <PlanRow
                key={w.id}
                workout={w}
                userId={userId}
                dateISO={dateISO}
                unitSystem={unitSystem}
                done={done.has(w.name.trim().toLowerCase())}
                loggedByPool={loggedByPool}
                bare={bare}
                hideName={bare && w.name.trim().toLowerCase() === group.label.toLowerCase()}
              />
            );
            // One plan for this muscle group: the plan is the card, as before.
            if (group.items.length === 1) return row(group.items[0], false);
            // Several (two chest workouts): one card, the group named once at the
            // top, each workout keeping its own fields and buttons below it.
            return (
              <div
                key={group.key}
                className="rounded-xl border border-hairline bg-ground/30 p-3"
              >
                <div className="text-sm font-semibold">{group.label}</div>
                <div className="mt-2 space-y-3">
                  {group.items.map((w) => (
                    <div
                      key={w.id}
                      className="border-t border-hairline pt-3 first:border-t-0 first:pt-0"
                    >
                      {row(w, true)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Same-muscle plans share a card; anything without a muscle group stands alone
 *  (grouping by name would merge two unrelated "Workout" plans). */
function groupByMuscle(
  workouts: PlanWorkout[],
): { key: string; label: string; items: PlanWorkout[] }[] {
  const out: { key: string; label: string; items: PlanWorkout[] }[] = [];
  const byKey = new Map<string, { key: string; label: string; items: PlanWorkout[] }>();
  for (const w of workouts) {
    const key = w.muscleGroup ? `mg:${w.muscleGroup}` : `solo:${w.id}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.items.push(w);
      continue;
    }
    const group = {
      key,
      label: w.muscleGroup ? MUSCLE_GROUP_LABEL[w.muscleGroup] : w.name,
      items: [w],
    };
    byKey.set(key, group);
    out.push(group);
  }
  return out;
}

function PlanRow({
  workout,
  userId,
  dateISO,
  unitSystem,
  done,
  loggedByPool = {},
}: {
  workout: PlanWorkout;
  userId: string;
  dateISO: string;
  unitSystem: UnitSystem;
  done: boolean;
  loggedByPool?: Record<string, string>;
  /** Rendered inside a shared muscle-group card: drop this row's own card. */
  bare?: boolean;
  /** Hide the plan name when the group heading already says it. */
  hideName?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const e of workout.exercises) {
      if (e.poolExerciseId && loggedByPool[e.poolExerciseId]) {
        init[e.id] = loggedByPool[e.poolExerciseId];
      }
    }
    return init;
  });
  const [pending, startTransition] = useTransition();

  const category: WorkoutCategory = workout.category ?? "WEIGHTS";
  const hiit = workout.hiit;
  const trackedExercises = workout.exercises.filter((e) => e.tracked);
  const untracked = workout.exercises.filter((e) => !e.tracked);
  const metricOnly = workout.exercises.length === 0;
  const soloMetric = defaultMetricFor(category);

  const metricFor = (m: Metric | null): Metric => m ?? defaultMetricFor(category);

  // Name the log button after what's being logged where that's unambiguous.
  let logLabel = "Log workout";
  if (!hiit) {
    if (metricOnly) {
      logLabel = `Log ${LOG_NOUN[soloMetric]}`;
    } else if (trackedExercises.length === 0) {
      logLabel = "Mark complete";
    } else {
      const metrics = new Set(trackedExercises.map((e) => metricFor(e.metric)));
      if (metrics.size === 1) {
        logLabel = `Log ${LOG_NOUN[[...metrics][0]]}`;
      }
    }
  }

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
        setValues({});
      });
      return;
    }

    const entries: {
      poolExerciseId: string | null;
      metric: Metric;
      value: number;
      unit: string;
      reps?: number | null;
    }[] = [];

    const push = (
      poolExerciseId: string | null,
      metric: Metric,
      raw: string,
      unit: string,
      repsRaw?: string,
    ) => {
      const num = Number(raw);
      if (!raw || !Number.isFinite(num) || num <= 0) return;
      const value = metric === "DURATION" ? num * 60 : num;
      const repsNum = Number(repsRaw);
      const reps =
        metric === "WEIGHT" && repsRaw && Number.isFinite(repsNum) && repsNum > 0
          ? Math.round(repsNum)
          : null;
      entries.push({ poolExerciseId, metric, value, unit, reps });
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
        push(
          e.poolExerciseId,
          m,
          values[e.id] ?? "",
          resolveUnit(m, e.unit),
          values[`${e.id}__reps`],
        );
      }
    }

    startTransition(async () => {
      await completePlannedWorkout({
        userId,
        dateISO,
        plannedWorkoutId: workout.id,
        entries,
      });
      setValues({});
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
    <div className={bare ? "" : "rounded-xl border border-hairline bg-ground/30 p-3"}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {!hideName && <div className="text-sm font-semibold">{workout.name}</div>}
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
      </div>

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
              label=""
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
                  <div key={e.id} className="flex items-end gap-2">
                    <div className="flex-1">
                      <MetricField
                        label={trackedExercises.length === 1 ? "" : e.name}
                        metric={m}
                        unit={unit}
                        hint={m === "WEIGHT" ? "today's max" : undefined}
                        value={values[e.id] ?? ""}
                        onChange={(v) => setVal(e.id, v)}
                      />
                    </div>
                    {/* Reps for the top set. Optional: the record is still the
                        weight, but without this "185 x 5" and "185 x 12" log
                        identically and months of rep progress stay invisible. */}
                    {m === "WEIGHT" && (
                      <div className="flex items-center gap-1.5 pb-0.5">
                        <span className="text-xs text-muted">×</span>
                        <input
                          inputMode="numeric"
                          value={values[`${e.id}__reps`] ?? ""}
                          onChange={(v) => setVal(`${e.id}__reps`, v.target.value)}
                          placeholder="reps"
                          aria-label={`${e.name} reps`}
                          className="tabular h-9 w-16 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                        />
                      </div>
                    )}
                  </div>
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
            className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-on-accent shadow-sm hover:shadow-md disabled:opacity-40"
          >
            <CheckIcon className="h-4 w-4" />
            {pending ? "Logging…" : logLabel}
          </button>
        </div>
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
      {label && (
        <span className="min-w-[8rem] flex-1 text-sm font-medium">{label}</span>
      )}
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
