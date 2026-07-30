"use client";

import { useMemo, useState, useTransition } from "react";
import { DAY_NAMES } from "@/lib/days";
import {
  addPlannedHiitWorkout,
  addPlannedRestDay,
  addPlannedWorkoutFromPool,
  copyDayPlan,
  removePlannedWorkout,
} from "@/lib/actions/workouts";
import { PlusIcon, TrashIcon } from "@/components/icons";
import type {
  PlanDay,
  PlanWorkout,
  PoolEntry,
  BoardHiitWorkout,
} from "@/lib/queries/workouts";
import {
  CATEGORY_LABEL,
  METRIC_LABEL_SHORT,
  METRIC_ONLY_CATEGORIES,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABEL,
  WORKOUT_TYPE_LABEL,
  formatHiitMovement,
  defaultMetricFor,
  metricChoicesFor,
  type Metric,
  type MuscleGroup,
  type WorkoutCategory,
} from "@/lib/workouts/catalog";

// Order the builder offers categories in — pool-backed first, then the
// metric-only ones (a run/row/ruck day is just the day).
const PLAN_CATEGORIES: WorkoutCategory[] = [
  "WEIGHTS",
  "HIIT",
  "ISOMETRIC",
  "STRETCHING",
  "SPORT",
  "RUNNING",
  "ROWING",
  "RUCKING",
];

export function PlanBuilder({
  userId,
  plan,
  todayDow,
  pool,
  hiitWorkouts,
}: {
  userId: string;
  plan: PlanDay[];
  todayDow: number;
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Build a training day from your movement pool &mdash; pick a category,
        choose the exercises, and mark which ones you want to log a number for.
        A day can hold more than one workout; empty days are rest days.
      </p>
      {plan.map((d) => (
        <DayRow
          key={d.day}
          userId={userId}
          day={d.day}
          workouts={d.workouts}
          plan={plan}
          pool={pool}
          hiitWorkouts={hiitWorkouts}
          isToday={d.day === todayDow}
        />
      ))}
    </div>
  );
}

function DayRow({
  userId,
  day,
  workouts,
  plan,
  pool,
  hiitWorkouts,
  isToday,
}: {
  userId: string;
  day: number;
  workouts: PlanWorkout[];
  plan: PlanDay[];
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
  isToday: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  const copyFrom = (from: number) => {
    if (from === day) return;
    startTransition(() => copyDayPlan(userId, from, day));
  };

  const otherDaysWithWork = plan.filter(
    (p) => p.day !== day && p.workouts.length > 0,
  );

  return (
    <div
      className={`rounded-xl border p-3 ${
        isToday ? "border-accent bg-accent/5" : "border-hairline bg-ground/30"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {DAY_NAMES[day]}
          {isToday && (
            <span className="ml-2 text-xs font-normal text-accent">today</span>
          )}
        </span>
        {otherDaysWithWork.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value !== "") copyFrom(Number(e.target.value));
            }}
            className="h-8 rounded-full border border-hairline bg-surface px-2.5 text-xs text-muted outline-none focus:border-accent"
          >
            <option value="">Copy from…</option>
            {otherDaysWithWork.map((p) => (
              <option key={p.day} value={p.day}>
                {DAY_NAMES[p.day]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-1.5">
        {workouts.map((w) => (
          <div
            key={w.id}
            className="flex items-start gap-2 rounded-lg bg-surface px-3 py-2 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{w.name}</div>
              {w.hiit ? (
                <div className="mt-0.5 text-xs text-muted">
                  {WORKOUT_TYPE_LABEL[w.hiit.type]}
                  {w.hiit.movements.length > 0 &&
                    ` · ${w.hiit.movements
                      .map((m) => formatHiitMovement(m))
                      .join(", ")}`}
                </div>
              ) : w.isRest ? null : w.exercises.length > 0 ? (
                <div className="mt-0.5 text-xs text-muted">
                  {w.exercises
                    .map((e) => (e.tracked ? e.name : `${e.name} (no log)`))
                    .join(" · ")}
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-muted">
                  {w.category
                    ? `Log ${METRIC_LABEL_SHORT[
                        defaultMetricFor(w.category)
                      ].toLowerCase()} on completion`
                    : "Legacy workout"}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label={`Remove ${w.name}`}
              onClick={() =>
                startTransition(() => removePlannedWorkout(w.id))
              }
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-red-700"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-hairline px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          <PlusIcon className="h-4 w-4" />
          Add workout
        </button>
      </div>

      {adding && (
        <AddWorkoutModal
          userId={userId}
          day={day}
          pool={pool}
          hiitWorkouts={hiitWorkouts}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

type Picked = { tracked: boolean; metric: Metric };

function AddWorkoutModal({
  userId,
  day,
  pool,
  hiitWorkouts,
  onClose,
}: {
  userId: string;
  day: number;
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
  onClose: () => void;
}) {
  const [category, setCategory] = useState<WorkoutCategory>("WEIGHTS");
  const [muscle, setMuscle] = useState<MuscleGroup>("CHEST");
  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const [hiitId, setHiitId] = useState("");
  const [rest, setRest] = useState(false);
  const [saving, startSave] = useTransition();

  const metricOnly = METRIC_ONLY_CATEGORIES.includes(category);
  const isWeights = category === "WEIGHTS";
  const isHiit = category === "HIIT";
  const choices = metricChoicesFor(category);
  const defMetric = defaultMetricFor(category);

  const mine = hiitWorkouts.filter((w) => w.ownerId === userId);
  const shared = hiitWorkouts.filter((w) => w.ownerId === null);

  const options = useMemo(
    () =>
      pool.filter(
        (p) =>
          p.isActive &&
          p.category === category &&
          (!isWeights || p.muscleGroup === muscle),
      ),
    [pool, category, isWeights, muscle],
  );

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { tracked: true, metric: defMetric };
      return next;
    });

  const setTracked = (id: string, tracked: boolean) =>
    setPicked((prev) => ({ ...prev, [id]: { ...prev[id], tracked } }));

  const setMetric = (id: string, metric: Metric) =>
    setPicked((prev) => ({ ...prev, [id]: { ...prev[id], metric } }));

  const chosen = Object.entries(picked);
  const canSave = rest
    ? true
    : isHiit
      ? !!hiitId
      : metricOnly || chosen.length > 0;

  const save = () => {
    if (!canSave) return;
    startSave(async () => {
      if (rest) {
        await addPlannedRestDay(userId, day);
      } else if (isHiit) {
        await addPlannedHiitWorkout(userId, day, hiitId);
      } else {
        await addPlannedWorkoutFromPool(userId, day, {
          category,
          muscleGroup: isWeights ? muscle : null,
          exercises: metricOnly
            ? []
            : chosen.map(([poolExerciseId, p]) => ({
                poolExerciseId,
                tracked: p.tracked,
                metric: p.metric,
              })),
        });
      }
      onClose();
    });
  };

  // Reset the picks whenever the pool subset changes underneath us.
  const changeCategory = (c: WorkoutCategory) => {
    setCategory(c);
    setPicked({});
    setHiitId("");
  };
  const changeMuscle = (m: MuscleGroup) => {
    setMuscle(m);
    setPicked({});
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h3 className="text-base font-semibold">
            Add to {DAY_NAMES[day]}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
              Category
            </label>
            <select
              value={rest ? "REST" : category}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "REST") {
                  setRest(true);
                } else {
                  setRest(false);
                  changeCategory(v as WorkoutCategory);
                }
              }}
              className="h-10 w-full rounded-xl border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
            >
              <option value="REST">Rest day</option>
              {PLAN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          {!rest && isWeights && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
                Muscle group
              </label>
              <select
                value={muscle}
                onChange={(e) => changeMuscle(e.target.value as MuscleGroup)}
                className="h-10 w-full rounded-xl border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>
                    {MUSCLE_GROUP_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {rest ? (
            <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
              Marks {DAY_NAMES[day]} as a planned rest day — no workout is
              expected and no prompt is created.
            </p>
          ) : isHiit ? (
            hiitWorkouts.length === 0 ? (
              <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
                No HIIT/CrossFit workouts yet. Build one in the Workouts admin,
                or log one from &ldquo;Log something else&rdquo; to add your own.
              </p>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
                  Workout
                </label>
                <select
                  value={hiitId}
                  onChange={(e) => setHiitId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="">Pick a workout…</option>
                  {mine.length > 0 && (
                    <optgroup label="Yours">
                      {mine.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {shared.length > 0 && (
                    <optgroup label="Shared">
                      {shared.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )
          ) : metricOnly ? (
            <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
              Adds a {CATEGORY_LABEL[category].toLowerCase()} day. You&rsquo;ll
              log {METRIC_LABEL_SHORT[defMetric].toLowerCase()} when you
              complete it.
            </p>
          ) : options.length === 0 ? (
            <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
              No {isWeights ? MUSCLE_GROUP_LABEL[muscle].toLowerCase() + " " : ""}
              {CATEGORY_LABEL[category].toLowerCase()} movements in the pool yet.
              Add some under Admin &rarr; Workouts &rarr; Exercise pool.
            </p>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
                Exercises
              </label>
              <div className="space-y-1.5">
                {options.map((o) => {
                  const p = picked[o.id];
                  const on = !!p;
                  return (
                    <div
                      key={o.id}
                      className={`rounded-xl border p-2.5 ${
                        on
                          ? "border-accent bg-accent/5"
                          : "border-hairline bg-ground/30"
                      }`}
                    >
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(o.id)}
                          className="h-4 w-4 accent-accent"
                        />
                        <span className="text-sm font-medium">{o.name}</span>
                      </label>

                      {on && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-7">
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                            <input
                              type="checkbox"
                              checked={p.tracked}
                              onChange={(e) =>
                                setTracked(o.id, e.target.checked)
                              }
                              className="h-3.5 w-3.5 accent-accent"
                            />
                            Log a metric
                          </label>
                          {p.tracked && choices.length > 1 && (
                            <select
                              value={p.metric}
                              onChange={(e) =>
                                setMetric(o.id, e.target.value as Metric)
                              }
                              className="h-7 rounded-full border border-hairline bg-surface px-2 text-xs outline-none focus:border-accent"
                            >
                              {choices.map((m) => (
                                <option key={m} value={m}>
                                  {METRIC_LABEL_SHORT[m]}
                                </option>
                              ))}
                            </select>
                          )}
                          {p.tracked && choices.length === 1 && (
                            <span className="text-xs text-muted">
                              {METRIC_LABEL_SHORT[choices[0]]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-muted hover:bg-ground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={save}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
