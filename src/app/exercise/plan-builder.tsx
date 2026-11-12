"use client";

import { WarmupChooser, WarmupPlanLine } from "./warmup-window";
import { CorePlanLine, CoreRotationPicker } from "./core-days";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DAY_NAMES } from "@/lib/days";
import { DateField } from "@/components/date-field";
import {
  addPlannedHiitWorkout,
  addPlannedRestDay,
  addPlannedWorkoutFromPool,
  copyDayPlan,
  removePlannedWorkout,
  saveSectionOrder,
  setCoreDayAction,
  setPlannedScheme,
  setWeeklyStart,
  setWeeklyEnd,
  setWeeklyActive,
} from "@/lib/actions/workouts";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { PlanFilePanel } from "./plan-file-panel";
import { PRIMARY_BTN, SECTION_CARD, SECTION_LABEL } from "./buttons";
import { blockKind, cleanOrder, isSimpleCategory, KIND_LABEL, type SectionKind } from "@/lib/workouts/blocks";
import { SCHEME_CHOICES, schemeChoiceKey } from "@/lib/workouts/programs";
import type { DayOrders } from "@/lib/workouts/day-order";
import { InfoToggle, MovementAbout, MovementInfo } from "@/components/movement-info";
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

/** The routine kind a done-with-a-tap category uses (v0.663). */
const routineKindOf = (c: string | null | undefined): "warmup" | "mobility" | "stretching" =>
  c === "MOBILITY" ? "mobility" : c === "STRETCHING" ? "stretching" : "warmup";

/** The plan-builder value for a Conditioning plan picked on the day (v0.617). */
const PICK_ON_THE_DAY = "pick";

// Order the builder offers categories in. Rowing, running and rucking are
// one "Cardio" now (v0.615): whichever gets done that day fills it.
const PLAN_CATEGORIES: WorkoutCategory[] = [
  "WEIGHTS",
  "HIIT",
  "CARDIO",
  "WARMUP",
  "MOBILITY",
  "STRETCHING",
  "ISOMETRIC",
  "SPORT",
];

const SELECT_SM =
  "h-7 rounded-full border border-hairline bg-surface px-2 text-xs outline-none focus:border-accent";

/** A day's sections as an ordered list with up/down: every day's order, or
 *  one weekday's own. */
function OrderEditor({
  order,
  onSave,
  onReset,
  resetLabel,
}: {
  order: SectionKind[];
  onSave: (o: SectionKind[]) => void;
  onReset?: () => void;
  resetLabel?: string;
}) {
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    onSave(next);
  };
  return (
    <div className="space-y-1">
      <ol className="space-y-1">
        {order.map((k, i) => (
          <li key={k} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 shadow-sm">
            <span className="tabular w-5 text-xs text-muted">{i + 1}</span>
            <span className="flex-1 text-sm">{KIND_LABEL[k]}</span>
            <button
              type="button"
              aria-label={`Move ${KIND_LABEL[k]} up`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
              className="h-7 w-7 rounded-full text-muted hover:bg-ground hover:text-ink disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${KIND_LABEL[k]} down`}
              disabled={i === order.length - 1}
              onClick={() => move(i, 1)}
              className="h-7 w-7 rounded-full text-muted hover:bg-ground hover:text-ink disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      {onReset && (
        <button type="button" onClick={onReset} className="text-xs font-medium text-accent hover:underline">
          {resetLabel}
        </button>
      )}
    </div>
  );
}

/** The section a planned workout sits in, for ordering the day's list. */
function kindOf(w: PlanWorkout): SectionKind {
  const k = blockKind(w.category, !!w.hiit);
  return k === "OTHER" ? "STRENGTH" : k;
}

export function PlanBuilder({
  userId,
  plan,
  todayDow,
  pool,
  hiitWorkouts,
  weeklyStart,
  weeklyEnd = "",
  weeklyActive,
  sectionOrder,
  onDone,
}: {
  onDone?: () => void;
  userId: string;
  plan: PlanDay[];
  todayDow: number;
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
  weeklyStart: string;
  /** The plan's last day (v0.686), or "" for no end. */
  weeklyEnd?: string;
  weeklyActive: boolean;
  sectionOrder: DayOrders;
}) {
  const [, startWeeklyStart] = useTransition();
  // Every change saves as it's made (v0.645): "Saved" shows each time the
  // plan comes back changed, and Done at the bottom leaves.
  const [savedAt, setSavedAt] = useState(0);
  const sig = JSON.stringify([plan, weeklyStart, weeklyEnd, weeklyActive]);
  const firstSig = useRef(sig);
  useEffect(() => {
    if (sig !== firstSig.current) {
      firstSig.current = sig;
      setSavedAt(Date.now());
    }
  }, [sig]);
  useEffect(() => {
    if (!savedAt) return;
    const t = window.setTimeout(() => setSavedAt(0), 1800);
    return () => window.clearTimeout(t);
  }, [savedAt]);
  const [orders, setOrders] = useState<DayOrders>(sectionOrder);
  const [orderOpen, setOrderOpen] = useState(false);
  const saveOrder = (day: number | null, order: SectionKind[] | null) => {
    // Shown at once; the server's cleaned copy replaces it.
    setOrders((cur) => {
      if (day == null) return { ...cur, everyDay: order ?? cleanOrder(null) };
      const days = { ...cur.days };
      if (order) days[day] = order;
      else delete days[day];
      return { ...cur, days };
    });
    void saveSectionOrder(userId, day, order)
      .then((o) => {
        setOrders(o);
        setSavedAt(Date.now());
      })
      .catch(() => undefined);
  };
  return (
    <div className="space-y-4">
      {/* Dates, pause and order on one card (v0.691), like the other full pages. */}
      <div className={SECTION_CARD}>
      <div className="flex items-center justify-between gap-2">
        <p className={SECTION_LABEL}>Schedule</p>
        <button
          type="button"
          onClick={() => startWeeklyStart(() => void setWeeklyActive(userId, !weeklyActive))}
          className="text-sm font-semibold text-accent hover:underline"
        >
          {weeklyActive ? "Pause" : "Resume"}
        </button>
      </div>
      {!weeklyActive && <p className="text-sm font-semibold text-muted">Paused</p>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="w-14 text-sm font-medium">Starts</label>
        <DateField
          defaultValue={weeklyStart}
          onChange={(v) => v && startWeeklyStart(() => void setWeeklyStart(userId, v))}
          ariaLabel="Weekly plan starts on"
          className="tabular h-9 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
        />
        {weeklyStart ? (
          <button
            type="button"
            onClick={() => startWeeklyStart(() => void setWeeklyStart(userId, ""))}
            className="text-xs font-medium text-muted hover:underline"
          >
            Clear
          </button>
        ) : (
          <span className="text-xs text-muted">Now</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="w-14 text-sm font-medium">Ends</label>
        <DateField
          defaultValue={weeklyEnd}
          onChange={(v) => v && startWeeklyStart(() => void setWeeklyEnd(userId, v))}
          ariaLabel="Weekly plan ends on"
          className="tabular h-9 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
        />
        {weeklyEnd ? (
          <button
            type="button"
            onClick={() => startWeeklyStart(() => void setWeeklyEnd(userId, ""))}
            className="text-xs font-medium text-muted hover:underline"
          >
            Clear
          </button>
        ) : (
          <span className="text-xs text-muted">No end</span>
        )}
      </div>
      <div className="border-t border-hairline pt-3">
        <button
          type="button"
          aria-expanded={orderOpen}
          onClick={() => setOrderOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-sm font-semibold">Order of the day</span>
          <span className="truncate text-xs text-muted">
            {orders.everyDay.map((k) => KIND_LABEL[k].replace(" (each muscle group)", "")).join(" → ")}
          </span>
        </button>
        {orderOpen && (
          <div className="mt-2">
            <OrderEditor order={orders.everyDay} onSave={(o) => saveOrder(null, o)} />
          </div>
        )}
      </div>
      </div>
      <p className={SECTION_LABEL}>Week</p>
      {plan.map((d) => (
        <DayRow
          key={d.day}
          order={orders.days[d.day] ?? null}
          everyDay={orders.everyDay}
          onOrder={(o) => saveOrder(d.day, o)}
          userId={userId}
          day={d.day}
          workouts={d.workouts}
          plan={plan}
          pool={pool}
          hiitWorkouts={hiitWorkouts}
          isToday={d.day === todayDow}
        />
      ))}
      <PlanFilePanel userId={userId} />
      {onDone && (
        <button type="button" onClick={onDone} className={`${PRIMARY_BTN} mt-2 w-full`}>
          Done
        </button>
      )}
      {savedAt > 0 && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center"
        >
          <span className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface shadow-lg">Saved</span>
        </div>
      )}
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
  order,
  everyDay,
  onOrder,
}: {
  /** This day's own order, or null for every day's. */
  order: SectionKind[] | null;
  everyDay: SectionKind[];
  onOrder: (o: SectionKind[] | null) => void;
  userId: string;
  day: number;
  workouts: PlanWorkout[];
  plan: PlanDay[];
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
  isToday: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [, startTransition] = useTransition();
  const dayOrder = order ?? everyDay;
  // Listed the way the day page shows them: by section, in this day's order.
  const listed = [...workouts].sort(
    (a, b) => (a.isRest ? -1 : dayOrder.indexOf(kindOf(a))) - (b.isRest ? -1 : dayOrder.indexOf(kindOf(b))),
  );

  const copyFrom = (from: number) => {
    if (from === day) return;
    startTransition(() => copyDayPlan(userId, from, day));
  };

  const otherDaysWithWork = plan.filter(
    (p) => p.day !== day && p.workouts.length > 0,
  );

  return (
    <div
      className={`rounded-xl border bg-surface px-4 py-3 ${isToday ? "border-accent" : "border-hairline"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {DAY_NAMES[day]}
          {isToday && (
            <span className="ml-2 text-xs font-normal text-accent">today</span>
          )}
        </span>
        {workouts.some((w) => !w.isRest) && (
          <button
            type="button"
            aria-expanded={ordering}
            onClick={() => setOrdering((o) => !o)}
            className="ml-auto text-xs font-medium text-muted hover:text-accent"
          >
            {order ? "Own order" : "Order"}
          </button>
        )}
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

      {ordering && (
        <div className="mb-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">{DAY_NAMES[day]} only</p>
          <OrderEditor
            order={dayOrder}
            onSave={(o) => onOrder(o)}
            onReset={order ? () => onOrder(null) : undefined}
            resetLabel="Use the order of every day"
          />
        </div>
      )}

      <div className="space-y-1.5">
        {listed.map((w) => (
          <div
            key={w.id}
            className="flex items-start gap-2 rounded-lg border border-hairline bg-ground/30 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {w.core ? (w.core.kind === "arms" ? "Arms" : w.core.kind === "iso" ? "Isometric" : "Core") : w.name}
                {!w.core && !w.isRest && kindOf(w) !== "STRENGTH" && KIND_LABEL[kindOf(w)] !== w.name && (
                  <span className="ml-2 text-xs font-normal text-muted">{KIND_LABEL[kindOf(w)]}</span>
                )}
              </div>
              {w.hiit ? (
                <div className="mt-0.5 text-xs text-muted">
                  {WORKOUT_TYPE_LABEL[w.hiit.type]}
                  {w.hiit.movements.length > 0 &&
                    ` · ${w.hiit.movements
                      .map((m) => formatHiitMovement(m))
                      .join(", ")}`}
                </div>
              ) : w.isRest ? null : w.core ? (
                <CorePlanLine userId={userId} pool={pool} workout={w} />
              ) : w.exercises.length > 0 && (w.category === "WEIGHTS" || w.category == null) ? (
                <ul className="mt-1 space-y-1">
                  {w.exercises.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-xs text-muted">
                      <span className="min-w-0 flex-1 truncate">{e.tracked ? e.name : `${e.name} (no log)`}</span>
                      <MovementInfo name={e.name} about={pool.find((p) => p.id === e.poolExerciseId)?.about} />
                      {e.tracked && (
                        <select
                          aria-label={`Sets for ${e.name}`}
                          value={schemeChoiceKey(e.scheme)}
                          onChange={(ev) =>
                            startTransition(() =>
                              setPlannedScheme(userId, w.id, e.poolExerciseId, ev.target.value),
                            )
                          }
                          className={SELECT_SM}
                        >
                          {SCHEME_CHOICES.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              ) : w.exercises.length > 0 ? (
                <div className="mt-0.5 text-xs text-muted">
                  {w.exercises
                    .map((e) => (e.tracked ? e.name : `${e.name} (no log)`))
                    .join(" · ")}
                </div>
              ) : w.category === "CARDIO" ? (
                <div className="mt-0.5 text-xs text-muted">Row, run, ruck or other</div>
              ) : w.category === "WARMUP" || w.category === "MOBILITY" || w.category === "STRETCHING" ? (
                <WarmupPlanLine
                  userId={userId}
                  plannedWorkoutId={w.id}
                  warmup={w.warmup ?? null}
                  kind={routineKindOf(w.category)}
                />
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
              onClick={() => {
                if (confirm(`Remove "${w.name}" from this day?`))
                  startTransition(() => removePlannedWorkout(w.id));
              }}
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-red-700"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-hairline px-3 text-sm font-medium text-muted hover:border-accent hover:text-accent"
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

type Picked = { tracked: boolean; metric: Metric; scheme: string };

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
  const [muscle, setMuscle] = useState<MuscleGroup | null>("CHEST");
  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const [hiitId, setHiitId] = useState("");
  const [rest, setRest] = useState(false);
  const [saving, startSave] = useTransition();
  const [peek, setPeek] = useState<string | null>(null);
  // Core (v0.637): a rotation of core workouts, or movements picked by hand.
  const [coreMode, setCoreMode] = useState<"rotation" | "pick">("rotation");
  const [coreRotation, setCoreRotation] = useState<string[]>([]);
  const [coreTest, setCoreTest] = useState(true);
  const [coreError, setCoreError] = useState("");
  // Warm-up (v0.638): its routine chosen as it's added; null is a plain check.
  const [warmupId, setWarmupId] = useState<string | null>(null);

  const simple = isSimpleCategory(category);
  const metricOnly = METRIC_ONLY_CATEGORIES.includes(category) || simple;
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
          (!isWeights || (p.muscleGroup ?? null) === muscle),
      ),
    [pool, category, isWeights, muscle],
  );

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else {
        // The movement's own "Logs as" (a plank is timed), else the category's.
        const own = pool.find((p) => p.id === id)?.metric;
        next[id] = { tracked: true, metric: own && choices.includes(own) ? own : defMetric, scheme: "" };
      }
      return next;
    });

  const setTracked = (id: string, tracked: boolean) =>
    setPicked((prev) => ({ ...prev, [id]: { ...prev[id], tracked } }));

  const setMetric = (id: string, metric: Metric) =>
    setPicked((prev) => ({ ...prev, [id]: { ...prev[id], metric } }));

  const chosen = Object.entries(picked);
  // Core and Arms (v0.651) and Isometric (v0.661) all rotate through workouts.
  const isIso = category === "ISOMETRIC";
  const rotKind: "core" | "arms" | "iso" = isIso ? "iso" : muscle === "ARMS" ? "arms" : "core";
  const rotatable = isIso || (category === "WEIGHTS" && (muscle === "CORE" || muscle === "ARMS"));
  const coreRot = rotatable && coreMode === "rotation";
  const canSave = rest
    ? true
    : coreRot
      ? coreRotation.length > 0
      : isHiit
      ? !!hiitId
      : metricOnly || chosen.length > 0;

  const save = () => {
    if (!canSave) return;
    startSave(async () => {
      if (rest) {
        await addPlannedRestDay(userId, day);
      } else if (coreRot) {
        const r = await setCoreDayAction(userId, { day, rotation: coreRotation, test: coreTest, kind: rotKind });
        if (!r.ok) {
          setCoreError(r.error);
          return;
        }
      } else if (isHiit && hiitId === PICK_ON_THE_DAY) {
        // Conditioning with no workout chosen ahead: picked, built or
        // written on the day (v0.617).
        await addPlannedWorkoutFromPool(userId, day, { category: "HIIT", name: "Conditioning", exercises: [] });
      } else if (isHiit) {
        await addPlannedHiitWorkout(userId, day, hiitId);
      } else {
        await addPlannedWorkoutFromPool(userId, day, {
          category,
          muscleGroup: isWeights ? muscle : null,
          ...(category === "WARMUP" || category === "MOBILITY" || category === "STRETCHING" ? { warmup: warmupId } : {}),
          exercises: metricOnly
            ? []
            : chosen.map(([poolExerciseId, p]) => ({
                poolExerciseId,
                tracked: p.tracked,
                metric: p.metric,
                scheme: isWeights && p.tracked && p.metric === "WEIGHT" ? p.scheme : "",
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
  const changeMuscle = (m: MuscleGroup | null) => {
    setMuscle(m);
    setPicked({});
    // Core and Arms rotations hold different workouts (v0.651).
    setCoreRotation([]);
    setCoreError("");
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-ground"
      onClick={onClose}
    >
      <div
        className="mx-auto flex min-h-full w-full max-w-3xl flex-col bg-surface"
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
                value={muscle ?? ""}
                onChange={(e) =>
                  changeMuscle(e.target.value ? (e.target.value as MuscleGroup) : null)
                }
                className="h-10 w-full rounded-xl border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>
                    {MUSCLE_GROUP_LABEL[m]}
                  </option>
                ))}
                {/* A deadlift is not a back lift or a leg lift; it is a
                    deadlift. Movements that refuse to sit in one group get
                    their own progress block, titled with their own name. */}
                <option value="">No group — its own chart</option>
              </select>
            </div>
          )}

          {!rest && rotatable && (
            <div className="flex overflow-hidden rounded-xl border border-accent text-sm font-semibold" role="radiogroup">
              {(
                [
                  ["rotation", isIso ? "Isometric rotation" : muscle === "ARMS" ? "Arms rotation" : "Core rotation"],
                  ["pick", "Pick movements"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={coreMode === k}
                  onClick={() => setCoreMode(k)}
                  className={`h-9 flex-1 ${coreMode === k ? "bg-accent text-on-accent" : "text-accent"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {coreRot ? (
            <div>
              <CoreRotationPicker
                key={rotKind}
                userId={userId}
                pool={pool}
                kind={rotKind}
                rotation={coreRotation}
                onRotation={setCoreRotation}
                test={coreTest}
                onTest={setCoreTest}
              />
              {coreError && <p className="mt-2 text-sm text-red-700">{coreError}</p>}
            </div>
          ) : rest ? (
            <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
              Marks {DAY_NAMES[day]} as a planned rest day — no workout is
              expected and no prompt is created.
            </p>
          ) : isHiit ? (
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
                <option value={PICK_ON_THE_DAY}>Pick on the day</option>
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
          ) : category === "WARMUP" || category === "MOBILITY" || category === "STRETCHING" ? (
            <WarmupChooser
              key={category}
              userId={userId}
              kind={routineKindOf(category)}
              value={warmupId}
              onChange={setWarmupId}
            />
          ) : simple ? null : metricOnly ? (
            <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
              Adds a {CATEGORY_LABEL[category].toLowerCase()} day. You&rsquo;ll
              log {METRIC_LABEL_SHORT[defMetric].toLowerCase()} when you
              complete it.
            </p>
          ) : options.length === 0 ? (
            <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
              No{" "}
              {isWeights
                ? (muscle ? MUSCLE_GROUP_LABEL[muscle].toLowerCase() : "ungrouped") + " "
                : ""}
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
                      <div className="flex items-center">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(o.id)}
                            className="h-4 w-4 accent-accent"
                          />
                          <span className="text-sm font-medium">{o.name}</span>
                        </label>
                        <InfoToggle
                          name={o.name}
                          open={peek === o.id}
                          onToggle={() => setPeek((x) => (x === o.id ? null : o.id))}
                        />
                      </div>
                      {peek === o.id && (
                        <div className="mt-1.5 -mx-2">
                          <MovementAbout name={o.name} about={o.about} />
                        </div>
                      )}

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
                          {isWeights && p.tracked && p.metric === "WEIGHT" && (
                            <select
                              aria-label={`Sets for ${o.name}`}
                              value={p.scheme}
                              onChange={(e) =>
                                setPicked((prev) => ({ ...prev, [o.id]: { ...prev[o.id], scheme: e.target.value } }))
                              }
                              className={SELECT_SM}
                            >
                              {SCHEME_CHOICES.map((c) => (
                                <option key={c.key} value={c.key}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
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
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-40"
          >
            {saving ? "Adding…" : coreRot ? `Add ${rotKind} day` : "Add workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
