"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import {
  completePlannedWorkout,
  listExercisePool,
  logHiitWorkout,
  restDay,
  type LoggedSet,
} from "@/lib/actions/workouts";
import { CheckIcon, DumbbellIcon, MoonIcon, SwapIcon } from "@/components/icons";
import {
  METRIC_LABEL_SHORT,
  MUSCLE_GROUP_LABEL,
  WORKOUT_TYPE_LABEL,
  formatHiitMovement,
  defaultMetricFor,
  hiitResult,
  metricUnit,
  type Metric,
  type MuscleGroup,
  type UnitSystem,
  type WorkoutCategory,
} from "@/lib/workouts/catalog";
import { WeightCalculator } from "./weight-calculator";
import type {
  PlanExercise,
  PlanWorkout,
  PoolEntry,
} from "@/lib/queries/workouts";

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
  completedOnISO,
}: {
  userId: string;
  dateISO: string;
  workouts: PlanWorkout[];
  doneLabels: string[];
  paused: string | null;
  rested: boolean;
  unitSystem: UnitSystem;
  heading?: string;
  /** Already-logged sets for this date, keyed by pool-exercise id. */
  loggedByPool?: Record<string, LoggedSet>;
  /**
   * The day these are actually being logged on, when that is not `dateISO`.
   * Set by the overdue section: the workout still counts for the day it was
   * due, but the history and attendance grid should say when it was really
   * done. Purely data — it changes nothing about how the card is drawn.
   */
  completedOnISO?: string;
}) {
  const todays = paused ? [] : workouts.filter((w) => !w.isRest);
  const done = new Set(doneLabels.map((l) => l.trim().toLowerCase()));

  /**
   * Whether THIS planned workout has been logged.
   *
   * Matching on the session's label marked every planned workout sharing a
   * name as done at once: two "Back" workouts on a day are indistinguishable
   * by label, so logging one ticked both, and the second could only be
   * recorded through "Log a different workout". Identity has been available
   * all along — `loggedByPool` is keyed by pool-exercise id and already
   * prefills the weights.
   *
   * A workout with no pool exercises (HIIT, metric-only) has nothing to match
   * on but its label, so that path is unchanged.
   */
  const isDone = (w: PlanWorkout) => {
    const ex = w.exercises ?? [];
    if (ex.length === 0) return done.has(w.name.trim().toLowerCase());
    return ex.every(
      (e) => e.poolExerciseId && loggedByPool[e.poolExerciseId],
    );
  };

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
                done={isDone(w)}
                loggedByPool={loggedByPool}
                completedOnISO={completedOnISO}
                bare={bare}
                // Inside a group card the muscle group is already named at the
                // top and every movement names itself, so the plan name is a
                // third copy. "Chest / Chest / bench press" was the result.
                hideName={bare}
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
                    // No rule here: PlanRow draws its own above the fields, and
                    // two stacked rules read as a double line.
                    <div key={w.id}>
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
  completedOnISO,
  bare = false,
  hideName = false,
}: {
  workout: PlanWorkout;
  userId: string;
  dateISO: string;
  unitSystem: UnitSystem;
  done: boolean;
  loggedByPool?: Record<string, LoggedSet>;
  /** The day this is really being logged on, when it is not `dateISO`. */
  completedOnISO?: string;
  /** Rendered inside a shared muscle-group card: drop this row's own card. */
  bare?: boolean;
  /** Hide the plan name when the group heading already says it. */
  hideName?: boolean;
}) {
  /** Today-only substitutions, keyed by planned-exercise id. Never written to
   *  the plan — they only change what the Log button sends. */
  const [swaps, setSwaps] = useState<Record<string, PoolPick | null>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const setSwap = (exerciseId: string, pick: PoolPick | null) =>
    setSwaps((s) => ({ ...s, [exerciseId]: pick }));

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const e of workout.exercises) {
      const logged = e.poolExerciseId ? loggedByPool[e.poolExerciseId] : null;
      if (logged) {
        init[e.id] = logged.weight;
        // Reps live under a suffixed key, the same one the log action reads.
        if (logged.reps) init[`${e.id}__reps`] = logged.reps;
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

  // Already recorded for this date: the fields are prefilled with what was
  // logged, so the button saves a correction rather than a first entry. The
  // phone has said "edit weight" for a while; the web still offered to log
  // something that was plainly sitting in the boxes.
  const alreadyLogged =
    workout.exercises.length > 0 &&
    workout.exercises.every(
      (e) => e.poolExerciseId && loggedByPool[e.poolExerciseId],
    );
  if (alreadyLogged || done) logLabel = "Edit weight";

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
      swappedFrom?: string | null;
    }[] = [];

    const push = (
      poolExerciseId: string | null,
      metric: Metric,
      raw: string,
      unit: string,
      repsRaw?: string,
      swappedFrom?: string | null,
    ) => {
      const num = Number(raw);
      if (!raw || !Number.isFinite(num) || num <= 0) return;
      // `raw` already carries seconds for DURATION (the field is min + sec), so
      // there is nothing to convert. A single box asking for "time" could not
      // say whether 2 meant two minutes or two seconds, and the phone read it
      // the other way: the same plank logged twice differed by 60x.
      const value = num;
      const repsNum = Number(repsRaw);
      const reps =
        metric === "WEIGHT" && repsRaw && Number.isFinite(repsNum) && repsNum > 0
          ? Math.round(repsNum)
          : null;
      entries.push({ poolExerciseId, metric, value, unit, reps, swappedFrom });
    };

    const resolveUnit = (m: Metric, exUnit?: string): string =>
      m === "DURATION"
        ? ""
        : m === "WEIGHT" && exUnit
          ? exUnit
          : metricUnit(m, unitSystem);

    if (metricOnly) {
      // Same min + sec convention as the planned rows, so every DURATION on
      // this screen is submitted in seconds and none of them is implied.
      const soloRaw =
        soloMetric === "DURATION"
          ? String(
              Number(values["_min"] || 0) * 60 + Number(values["_sec"] || 0) || "",
            )
          : (values["_solo"] ?? "");
      push(null, soloMetric, soloRaw, resolveUnit(soloMetric));
    } else {
      for (const e of trackedExercises) {
        const m = metricFor(e.metric);
        // A movement swapped for today logs under the variation actually
        // lifted, carrying the planned movement's id so the slot it fills is
        // still known on the way back.
        const sw = swaps[e.id];
        const raw =
          m === "DURATION"
            ? String(
                Number(values[`${e.id}__min`] || 0) * 60 +
                  Number(values[`${e.id}__sec`] || 0) || "",
              )
            : (values[e.id] ?? "");
        push(
          sw ? sw.id : e.poolExerciseId,
          m,
          raw,
          resolveUnit(m, sw?.unit || e.unit),
          values[`${e.id}__reps`],
          sw ? e.poolExerciseId : null,
        );
      }
    }

    startTransition(async () => {
      await completePlannedWorkout({
        userId,
        dateISO,
        plannedWorkoutId: workout.id,
        entries,
        completedOnISO,
      });
      // Deliberately NOT cleared. What is in these boxes is now what the server
      // holds, so wiping them makes a successful save look like a failed one —
      // the numbers vanished and only came back on a full refresh. The prefill
      // runs in a useState initialiser, which does not re-run on revalidation,
      // so nothing was going to put them back until the component remounted.
    });
  };

  // A logged movement keeps its ordinary row \u2014 weight and reps filled in, with
  // the button reading "Edit weight". Collapsing it to a tick and the word
  // "Logged" hid the numbers, which are the thing you reopen the day to check.

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
            // Deliberately nothing: every movement names itself directly above
            // its own entry field. A summary list here repeated those names a
            // second time under the muscle group for no gain.
            null
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
            soloMetric === "DURATION" ? (
              <div className="flex items-center gap-1.5">
                <input
                  inputMode="numeric"
                  value={values["_min"] ?? ""}
                  onChange={(v) => setVal("_min", v.target.value)}
                  placeholder="0"
                  aria-label="Minutes"
                  className="tabular h-9 w-14 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                />
                <span className="text-xs text-muted">min</span>
                <input
                  inputMode="numeric"
                  value={values["_sec"] ?? ""}
                  onChange={(v) => setVal("_sec", v.target.value)}
                  placeholder="00"
                  aria-label="Seconds"
                  className="tabular h-9 w-14 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                />
                <span className="text-xs text-muted">sec</span>
              </div>
            ) : (
            <MetricField
              label=""
              metric={soloMetric}
              unit={metricUnit(soloMetric, unitSystem)}
              value={values["_solo"] ?? ""}
              onChange={(v) => setVal("_solo", v)}
            />
            )
          ) : (
            <>
              {trackedExercises.map((e, i) => {
                const m = metricFor(e.metric);
                const unit =
                  m === "WEIGHT"
                    ? e.unit || metricUnit(m, unitSystem)
                    : metricUnit(m, unitSystem);
                const sw = swaps[e.id];
                return (
                  // One rule between movements in a card, none above the first
                  // (the card's own rule already sits under the muscle group).
                  <div
                    key={e.id}
                    className={i > 0 ? "border-t border-hairline pt-2.5" : ""}
                  >
                  {/* Swap belongs to the movement, so it sits against the name
                      rather than across the card. The name still truncates (it
                      can shrink but not grow), and the trailing spacer absorbs
                      the rest of the row so the button stays put. */}
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="min-w-0 truncate text-sm">
                      {sw ? sw.name : e.name}
                      {sw && (
                        <span className="ml-1 text-muted">for {e.name}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        sw ? setSwap(e.id, null) : setPicking(e.id)
                      }
                      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs ${
                        sw
                          ? "border-hairline text-muted hover:border-accent hover:text-accent"
                          : "border-hairline text-accent hover:bg-accent/5"
                      }`}
                    >
                      <SwapIcon className="h-3.5 w-3.5" />
                      {sw ? "Undo" : "Swap"}
                    </button>
                    <span className="flex-1" />
                  </div>
                  <div className="flex items-end gap-2">
                    {m === "DURATION" ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          inputMode="numeric"
                          value={values[`${e.id}__min`] ?? ""}
                          onChange={(v) => setVal(`${e.id}__min`, v.target.value)}
                          placeholder="0"
                          aria-label={`${e.name} minutes`}
                          className="tabular h-9 w-14 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                        />
                        <span className="text-xs text-muted">min</span>
                        <input
                          inputMode="numeric"
                          value={values[`${e.id}__sec`] ?? ""}
                          onChange={(v) => setVal(`${e.id}__sec`, v.target.value)}
                          placeholder="00"
                          aria-label={`${e.name} seconds`}
                          className="tabular h-9 w-14 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                        />
                        <span className="text-xs text-muted">sec</span>
                      </div>
                    ) : (
                    <MetricField
                      label=""
                      metric={m}
                      unit={sw && m === "WEIGHT" ? sw.unit || unit : unit}
                      hint={m === "WEIGHT" ? "weight" : undefined}
                      value={values[e.id] ?? ""}
                      onChange={(v) => setVal(e.id, v)}
                    />
                    )}
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
                    {/* History for THIS movement, hard right of its own entry
                        fields. Attached to the movement rather than the card:
                        "best bench" means nothing on a card holding three
                        different lifts. */}
                    {e.stats && (
                      <div className="ml-auto pb-0.5">
                        <MovementHistory stats={e.stats} unit={unit} />
                      </div>
                    )}
                  </div>
                  {picking === e.id && (
                    <SwapPicker
                      exercise={e}
                      onPick={(p) => {
                        setSwap(e.id, p);
                        setPicking(null);
                      }}
                      onClose={() => setPicking(null)}
                    />
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

          {/* Three labelled tiles, same shape and wording as the phone, so the
              two logging screens read as one feature. */}
          <div className="mt-1 grid grid-cols-3 gap-2">
            <PlanActionTile
              icon={MoonIcon}
              label="Rest / skip"
              disabled={pending}
              onClick={() => startTransition(async () => {
                await restDay(userId, dateISO);
              })}
            />
            <PlanActionTile
              icon={DumbbellIcon}
              label="Calculator"
              disabled={false}
              onClick={() => setCalcOpen(true)}
            />
            <PlanActionTile
              icon={CheckIcon}
              label={pending ? "Logging…" : logLabel}
              disabled={pending}
              primary
              onClick={complete}
            />
          </div>
          {calcOpen && <WeightCalculator onClose={() => setCalcOpen(false)} />}
        </div>
    </div>
  );
}

function PlanActionTile({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: (p: { className?: string }) => React.ReactElement;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors disabled:opacity-40 ${
        primary
          ? "border-accent bg-accent text-on-accent"
          : "border-hairline text-ink hover:border-accent hover:text-accent"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

type PoolPick = {
  id: string;
  name: string;
  unit: string;
  muscleGroup: MuscleGroup | null;
};

/**
 * Pick a variation for one movement, for today only. The list is **grouped by
 * muscle group** with a heading per group — a flat alphabetical pool mixes
 * chest and calves together and is unusable once there are more than a dozen
 * movements. The movement's own group comes first, then the rest alphabetically,
 * and only same-category movements are offered (swapping a bench press for a
 * plank is not the point).
 */
function SwapPicker({
  exercise,
  onPick,
  onClose,
}: {
  exercise: PlanExercise;
  onPick: (p: PoolPick) => void;
  onClose: () => void;
}) {
  const [pool, setPool] = useState<PoolEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    listExercisePool()
      .then((rows) => {
        if (live) setPool(rows);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const groups = useMemo(() => {
    if (!pool) return [];
    const needle = q.trim().toLowerCase();
    const mine = pool.find((p) => p.id === exercise.poolExerciseId);
    const byGroup = new Map<string, { label: string; items: PoolEntry[] }>();

    for (const p of pool) {
      if (!p.isActive || p.id === exercise.poolExerciseId) continue;
      if (mine && p.category !== mine.category) continue;
      if (needle && !p.name.toLowerCase().includes(needle)) continue;
      const key = p.muscleGroup ?? "_other";
      const label = p.muscleGroup ? MUSCLE_GROUP_LABEL[p.muscleGroup] : "Other";
      const bucket = byGroup.get(key);
      if (bucket) bucket.items.push(p);
      else byGroup.set(key, { label, items: [p] });
    }

    // Straight alphabetical by muscle group, movements alphabetical inside
    // each. Floating the current group to the top meant the list started
    // somewhere different every time it opened.
    return [...byGroup.entries()]
      .map(([key, g]) => ({
        key,
        label: g.label,
        items: g.items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        if (a.key === "_other") return 1;
        if (b.key === "_other") return -1;
        return a.label.localeCompare(b.label);
      });
  }, [pool, q, exercise.poolExerciseId]);

  return (
    <div className="mt-2 rounded-xl border border-hairline bg-surface p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movements"
          aria-label="Search movements"
          className="h-8 min-w-0 flex-1 rounded-lg border border-hairline bg-ground/30 px-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
      <p className="mb-1.5 text-xs text-muted">
        Today only — your plan keeps {exercise.name}.
      </p>
      <div className="max-h-64 overflow-y-auto">
        {failed ? (
          <p className="px-1 py-2 text-xs text-muted">
            Couldn&rsquo;t load the movement list.
          </p>
        ) : pool === null ? (
          <p className="px-1 py-2 text-xs text-muted">Loading movements…</p>
        ) : groups.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted">No movements match.</p>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="mb-1.5">
              <p className="px-1 pb-0.5 pt-1.5 text-xs font-bold uppercase tracking-wide text-accent">
                {g.label}
              </p>
              {g.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    onPick({
                      id: p.id,
                      name: p.name,
                      unit: p.unit,
                      muscleGroup: p.muscleGroup,
                    })
                  }
                  className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ground/50"
                >
                  {p.name}
                </button>
              ))}
            </div>
          ))
        )}
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

/**
 * Three lines of history for one movement, to the right of its entry fields.
 *
 * Always three, with an em dash where there is nothing yet: a line that
 * disappears moves the other two, and a card that changes shape as you log is
 * harder to read at a glance than one with a gap in it.
 *
 * They answer three different questions and must not be collapsed:
 *   Best weight — the heaviest ever lifted, weight only.
 *   Best reps   — the MOST reps ever done, with the weight they were done at.
 *                 Usually a lighter bar than the record, which is the point.
 *   Most recent — the last session, even when it is below both records.
 *
 * Labels in the accent colour, numbers in the ordinary text colour.
 */
function MovementHistory({
  stats,
  unit,
}: {
  stats: NonNullable<PlanExercise["stats"]>;
  unit: string;
}) {
  const dash = "\u2014";
  const lines: [string, string][] = [
    [
      "Best weight",
      `${trimNum(stats.bestWeight)} ${unit}  \u00b7  ${mdSlash(stats.bestOn)}`,
    ],
    [
      "Best reps",
      stats.bestReps && stats.bestRepsWeight != null
        ? `${trimNum(stats.bestRepsWeight)} ${unit} \u00d7 ${stats.bestReps}${
            stats.bestRepsOn ? `  \u00b7  ${mdSlash(stats.bestRepsOn)}` : ""
          }`
        : dash,
    ],
    [
      "Most recent",
      `${trimNum(stats.lastWeight)} ${unit}${
        stats.lastReps ? ` \u00d7 ${stats.lastReps}` : ""
      }  \u00b7  ${mdSlash(stats.lastOn)}`,
    ],
  ];

  // A two-column grid rather than three right-aligned rows: with rows, each
  // label floats to wherever its own value ends and the labels come out ragged.
  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-2 text-xs leading-tight">
      {lines.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-right font-semibold text-accent">{k}</dt>
          <dd className="tabular whitespace-nowrap text-right">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** 105, not 105.0 — which JS numbers already give; this just names the intent. */
function trimNum(v: number): string {
  return String(v);
}

/** "10/5" — the same numeric date the phone and Recent workouts use. */
function mdSlash(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}
