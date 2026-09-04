"use client";

import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { PersonAvatar } from "@/components/person-filter";
import {
  CheckIcon,
  CalendarPlusIcon,
  DumbbellIcon,
  BookIcon,
  MoonIcon,
  PlusIcon,
  TrashIcon,
  TrophyIcon,
} from "@/components/icons";
import {
  deleteWorkoutSession,
  logCustomWorkout,
  logHiitWorkout,
  createAndLogHiitWorkout,
  requestShareHiitWorkout,
  restDay,
  markWorkedOut,
} from "@/lib/actions/workouts";
import { addDays } from "@/lib/dates";
import { PlanBuilder } from "./plan-builder";
import { RotationBuilder } from "./rotation-builder";
import { TodayPlan } from "./workout-card";
import { LineChart } from "@/components/line-chart";
import { WeightCalculator } from "./weight-calculator";
import type {
  PersonWorkout,
  PoolEntry,
  BoardHiitWorkout,
} from "@/lib/queries/workouts";
import type { WeeklyActivity } from "@/lib/queries/weekly-activity";
import {
  CATEGORY_LABEL,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABEL,
  POOL_CATEGORIES,
  WORKOUT_TYPES,
  WORKOUT_TYPE_LABEL,
  formatHiitMovement,
  hiitResult,
  type Metric,
  type UnitSystem,
  type WorkoutCategory,
  type WorkoutType,
} from "@/lib/workouts/catalog";

type Step = "menu" | "plan" | "log" | "history" | "browse";

export function WorkoutsGrid({
  people,
  personal = false,
  weeklyActivity = [],
  unitSystem,
  pool,
  hiitWorkouts,
  todayISO,
  todayDow,
}: {
  people: PersonWorkout[];
  personal?: boolean;
  weeklyActivity?: WeeklyActivity[];
  unitSystem: UnitSystem;
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
  todayISO: string;
  todayDow: number;
}) {
  const [openId, setOpenId] = useState<string | null>(
    personal ? (people[0]?.user.id ?? null) : null,
  );
  const [step, setStep] = useState<Step>("menu");
  const [calcOpen, setCalcOpen] = useState(false);
  // When creating a plan from scratch, which kind the person chose (before one
  // exists). Once a plan or rotation exists, that decides what's shown instead.
  const [planMode, setPlanMode] = useState<"weekly" | "rotation" | null>(null);
  // Which day the log step writes to. Defaults to today; can be set back to a
  // recent past day to record a workout that wasn't logged at the time.
  const [logDate, setLogDate] = useState(todayISO);
  const [browseFilter, setBrowseFilter] = useState<"regular" | "hero">(
    "regular",
  );
  // Which side of the screen the opened card was tapped on, so the pop-out
  // grows outward from roughly where it sat rather than always from centre.
  const [origin, setOrigin] = useState("center top");
  const [editingHistory, setEditingHistory] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const openFrom = (id: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const mid = r.left + r.width / 2;
    const third = window.innerWidth / 3;
    const x = mid < third ? "left" : mid > third * 2 ? "right" : "center";
    setOrigin(`${x} top`);
    setOpenId(id);
    setStep("menu");
    setPlanMode(null);
    setLogDate(todayISO);
  };

  const open = people.find((p) => p.user.id === openId) ?? null;
  const hasPlan = open ? open.plan.some((d) => d.workouts.length > 0) : false;
  // Named workouts available to this person: the shared library plus their own.
  const browsable = open
    ? hiitWorkouts.filter(
        (w) => w.ownerId === null || w.ownerId === open.user.id,
      )
    : [];

  const close = () => setOpenId(null);
  const rest = () => {
    if (open) startTransition(() => restDay(open.user.id, todayISO));
    close();
  };

  return (
    <>
      {!personal && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => {
            return (
              <button
                key={p.user.id}
                type="button"
                onClick={(e) => openFrom(p.user.id, e.currentTarget)}
                className="hover-bounce group flex flex-col rounded-xl border border-hairline bg-surface p-5 text-left outline-none transition-colors hover:border-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <PersonAvatar
                    name={p.user.name}
                    color={p.user.color}
                    avatarPath={p.user.avatarPath}
                    avatarPosition={p.user.avatarPosition}
                  />
                </div>
                <div className="mt-2">
                  <TileStatus person={p} />
                </div>
                {/* Preview of the actions — icons only and softly out of focus at
                    rest; they come sharp (and gain their labels) once the card is
                    tapped open. */}
                <div className="mt-4 grid grid-cols-3 gap-3" aria-hidden>
                  <ActionChip icon={CalendarPlusIcon} />
                  <ActionChip icon={DumbbellIcon} />
                  <ActionChip icon={MoonIcon} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <div
          className={
            personal
              ? ""
              : "animate-backdrop-fade fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
          }
          role={personal ? undefined : "dialog"}
          aria-modal={personal ? undefined : "true"}
          aria-label={personal ? undefined : `${open.user.name}'s workouts`}
          onClick={personal ? undefined : close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={personal ? undefined : { transformOrigin: origin }}
            className={
              personal ? "w-full" : "animate-card-zoom my-4 w-full max-w-2xl"
            }
          >
            <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-xl">
              {!personal && (
                <div className="flex items-start justify-between gap-3">
                  <PersonAvatar
                    name={open.user.name}
                    color={open.user.color}
                    avatarPath={open.user.avatarPath}
                    avatarPosition={open.user.avatarPosition}
                  />
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
              )}

              {step === "menu" && (
                <div className="mt-5 space-y-5">
                  {personal && (
                    <PersonalTop
                      open={open}
                      todayDow={todayDow}
                      weekly={weeklyActivity}
                    />
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                      Today
                    </p>
                    {open.today.rested ? (
                      <p className="mt-1 text-lg font-semibold">Rest day taken</p>
                    ) : open.todayWorkouts.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {open.todayWorkouts.map((w) => (
                          <li
                            key={w.id}
                            className="flex items-center gap-2 rounded-xl border border-hairline bg-ground/40 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {w.label}
                              </p>
                              {w.result && (
                                <p className="truncate text-xs text-muted">
                                  {w.result}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove ${w.label}`}
                              onClick={() =>
                                startTransition(() => deleteWorkoutSession(w.id))
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-red-700"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : open.today.workedOut ? (
                      <p className="mt-1 text-lg font-semibold text-accent">
                        Worked out
                      </p>
                    ) : open.today.paused ? (
                      <p className="mt-1 text-lg font-semibold">
                        Paused for {open.today.paused}
                      </p>
                    ) : open.todayPlanned.length > 0 ? (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {open.todayPlanned.map((w) => (
                          <span
                            key={w.id}
                            className="rounded-full bg-ground px-3 py-1 text-sm font-medium"
                          >
                            {w.name}
                          </span>
                        ))}
                      </p>
                    ) : hasPlan ? (
                      <p className="mt-1 text-lg font-semibold">Rest day</p>
                    ) : (
                      <p className="mt-1 text-sm text-muted">No plan yet.</p>
                    )}
                  </div>

                  {!personal && open.weightSeries.length > 0 && (
                    <LineChart
                      weight
                      series={open.weightSeries.map((s) => ({
                        id: s.exerciseId,
                        name: s.name,
                        color: s.color,
                        unit: s.unit,
                        points: s.points,
                      }))}
                    />
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <ActionButton
                      icon={CalendarPlusIcon}
                      label={hasPlan ? "Edit plan" : "Create plan"}
                      onClick={() => setStep("plan")}
                      primary={!hasPlan}
                    />
                    <ActionButton
                      icon={DumbbellIcon}
                      label="Log workout"
                      onClick={() => setStep("log")}
                      primary={hasPlan}
                    />
                    <ActionButton
                      icon={MoonIcon}
                      label="Rest / skip"
                      onClick={rest}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep("browse")}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    <BookIcon className="h-4 w-4" />
                    Browse workouts
                  </button>

                  {personal && (
                    <button
                      type="button"
                      onClick={() => setCalcOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
                    >
                      <DumbbellIcon className="h-4 w-4" />
                      Weight calculator
                    </button>
                  )}

                  {open.history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep("history")}
                      className="text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
                    >
                      Recent workouts →
                    </button>
                  )}
                </div>
              )}

              {step === "plan" && (
                <div className="mt-4">
                  <BackLink onClick={() => setStep("menu")} />
                  <h3 className="mb-3 font-display text-lg font-semibold">
                    Workout plan
                  </h3>
                  {(() => {
                    const hasRotation = !!open.rotation;
                    const hasWeekly = open.plan.some((d) =>
                      d.workouts.some((w) => !w.isRest),
                    );
                    const showRotation =
                      hasRotation || planMode === "rotation";
                    const showWeekly =
                      !showRotation && (hasWeekly || planMode === "weekly");

                    if (showRotation) {
                      return (
                        <RotationBuilder
                          userId={open.user.id}
                          rotation={open.rotation}
                        />
                      );
                    }
                    if (showWeekly) {
                      return (
                        <PlanBuilder
                          userId={open.user.id}
                          plan={open.plan}
                          todayDow={todayDow}
                          pool={pool}
                          hiitWorkouts={hiitWorkouts.filter(
                            (w) =>
                              w.ownerId === null ||
                              w.ownerId === open.user.id,
                          )}
                        />
                      );
                    }
                    return (
                      <div>
                        <p className="mb-4 text-sm text-muted">
                          How should this plan work?
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setPlanMode("weekly")}
                            className="rounded-2xl border border-hairline p-4 text-left transition-colors hover:border-accent"
                          >
                            <span className="block font-display text-base font-semibold">
                              Weekly plan
                            </span>
                            <span className="mt-1 block text-sm text-muted">
                              The same workouts on set weekdays — e.g. legs every
                              Monday, chest every Thursday.
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlanMode("rotation")}
                            className="rounded-2xl border border-hairline p-4 text-left transition-colors hover:border-accent"
                          >
                            <span className="block font-display text-base font-semibold">
                              Rotation
                            </span>
                            <span className="mt-1 block text-sm text-muted">
                              A repeating cycle of workouts (chest, legs, push…)
                              that runs off the weekly grid, with rest days that
                              pause it.
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {step === "log" && (
                <div className="mt-4 space-y-6">
                  <BackLink onClick={() => setStep("menu")} />
                  <h3 className="font-display text-lg font-semibold">
                    Log workout
                  </h3>

                  <div>
                    <label
                      htmlFor="log-date"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Date
                    </label>
                    <input
                      id="log-date"
                      type="date"
                      value={logDate}
                      max={todayISO}
                      min={addDays(todayISO, -90)}
                      onChange={(e) => setLogDate(e.target.value || todayISO)}
                      className="tabular h-11 rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
                    />
                    {logDate !== todayISO && (
                      <p className="mt-1 text-xs text-muted">
                        Recording a workout for an earlier day.
                      </p>
                    )}
                  </div>

                  {logDate === todayISO ? (
                    <>
                      <TodayPlan
                        userId={open.user.id}
                        dateISO={todayISO}
                        workouts={open.plan[todayDow]?.workouts ?? []}
                        doneLabels={open.todayWorkouts.map((w) => w.label)}
                        paused={open.today.paused}
                        rested={open.today.rested}
                        unitSystem={unitSystem}
                      />

                      <div className="border-t border-hairline pt-5">
                        <h4 className="mb-3 font-display text-sm font-semibold">
                          Log a different workout
                        </h4>
                        <CustomWorkoutForm
                          userId={open.user.id}
                          unitSystem={unitSystem}
                          pool={pool}
                          hiitWorkouts={hiitWorkouts}
                          dateISO={todayISO}
                          onDone={() => setStep("menu")}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(async () => {
                              await markWorkedOut(open.user.id, logDate, true);
                              setStep("menu");
                            })
                          }
                          className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white"
                        >
                          Mark workout done
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(async () => {
                              await restDay(open.user.id, logDate);
                              setStep("menu");
                            })
                          }
                          className="inline-flex h-10 items-center rounded-full border border-hairline px-5 text-sm font-medium text-muted hover:text-ink"
                        >
                          Rest day
                        </button>
                      </div>

                      <div className="border-t border-hairline pt-5">
                        <h4 className="mb-1 font-display text-sm font-semibold">
                          Log a specific workout
                        </h4>
                        <p className="mb-3 text-sm text-muted">
                          Record what was actually done that day &mdash; pick the
                          type, choose the movement, drop in the result.
                        </p>
                        <CustomWorkoutForm
                          userId={open.user.id}
                          unitSystem={unitSystem}
                          pool={pool}
                          hiitWorkouts={hiitWorkouts}
                          dateISO={logDate}
                          onDone={() => setStep("menu")}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {step === "browse" && (
                <div className="mt-4">
                  <BackLink onClick={() => setStep("menu")} />
                  <h3 className="mb-3 font-display text-lg font-semibold">
                    Browse workouts
                  </h3>

                  <div className="mb-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBrowseFilter("regular")}
                      aria-pressed={browseFilter === "regular"}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                        browseFilter === "regular"
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-hairline text-muted hover:border-accent"
                      }`}
                    >
                      <DumbbellIcon className="h-4 w-4" />
                      Workouts
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrowseFilter("hero")}
                      aria-pressed={browseFilter === "hero"}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                        browseFilter === "hero"
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-hairline text-muted hover:border-accent"
                      }`}
                    >
                      <TrophyIcon className="h-4 w-4" />
                      Hero WODs
                    </button>
                  </div>

                  {(() => {
                    const list = browsable.filter((w) =>
                      browseFilter === "hero" ? w.heroWod : !w.heroWod,
                    );
                    if (list.length === 0) {
                      return (
                        <p className="text-sm text-muted">
                          {browseFilter === "hero"
                            ? "No Hero WODs yet."
                            : "No named workouts yet. Build one in the Workouts admin."}
                        </p>
                      );
                    }
                    return (
                      <ul className="space-y-2">
                        {list.map((w) => (
                          <li
                            key={w.id}
                            className="rounded-xl border border-hairline bg-ground/30 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">
                                {w.name}
                              </span>
                              <span className="rounded-full bg-ground px-2 py-0.5 text-xs font-medium text-muted">
                                {WORKOUT_TYPE_LABEL[w.type]}
                              </span>
                              {w.ownerId && (
                                <span className="text-xs text-muted">
                                  Personal
                                </span>
                              )}
                            </div>
                            <p className="mt-1 whitespace-pre-line text-xs text-muted">
                              {w.instructions?.trim()
                                ? w.instructions
                                : w.movements.length > 0
                                  ? w.movements
                                      .map((m) => formatHiitMovement(m))
                                      .join(", ")
                                  : "No details yet."}
                            </p>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              )}

              {step === "history" && (
                <div className="mt-4">
                  <BackLink onClick={() => setStep("menu")} />
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-lg font-semibold">
                      Recent workouts
                    </h3>
                    {open.history.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHistory((e) => !e);
                          setConfirmDeleteId(null);
                        }}
                        className="text-sm font-semibold text-accent"
                      >
                        {editingHistory ? "Done" : "Edit"}
                      </button>
                    )}
                  </div>
                  {open.history.length === 0 ? (
                    <p className="text-sm text-muted">No past workouts.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {open.history.map((h) => (
                        <li
                          key={h.id}
                          className="flex items-center gap-2 rounded-xl border border-hairline bg-ground/40 px-3 py-2"
                        >
                          <span className="w-16 shrink-0 text-xs font-medium text-muted">
                            {fmtHistoryDate(h.dateISO)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {h.label}
                            </p>
                            {h.result && (
                              <p className="truncate text-xs text-muted">
                                {h.result}
                              </p>
                            )}
                          </div>
                          {editingHistory &&
                            (confirmDeleteId === h.id ? (
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="rounded-full px-2 py-1 text-xs font-medium text-muted hover:bg-black/5"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmDeleteId(null);
                                    startTransition(() =>
                                      deleteWorkoutSession(h.id),
                                    );
                                  }}
                                  className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Delete ${h.label} on ${h.dateISO}`}
                                onClick={() => setConfirmDeleteId(h.id)}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-red-700"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {calcOpen && <WeightCalculator onClose={() => setCalcOpen(false)} />}
    </>
  );
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type GraphChoice =
  | { kind: "none" }
  | { kind: "chart"; label: string; series: PersonWorkout["weightSeries"] };

/**
 * Which weight movements to graph, and the caption for them. If today has a
 * weights workout the series is already today's (scoped server-side); otherwise
 * we look ahead to the next day that has one and scope to its movements. With no
 * logged weight numbers at all there's nothing to graph — the weekly list stands
 * in instead.
 */
function chooseGraph(open: PersonWorkout, todayDow: number): GraphChoice {
  const hasData = open.weightSeries.some((s) => s.points.length > 0);
  if (!hasData) return { kind: "none" };

  const weightsOn = (d: number) =>
    (open.plan[d]?.workouts ?? []).filter(
      (w) => w.category === "WEIGHTS" && !w.isRest,
    );

  if (weightsOn(todayDow).length > 0) {
    return { kind: "chart", label: "Today", series: open.weightSeries };
  }

  for (let i = 1; i <= 7; i++) {
    const d = (todayDow + i) % 7;
    const workouts = weightsOn(d);
    if (workouts.length === 0) continue;
    const poolIds = new Set(
      workouts.flatMap((w) =>
        w.exercises.filter((e) => e.tracked).map((e) => e.poolExerciseId),
      ),
    );
    const series = open.weightSeries.filter((s) => poolIds.has(s.exerciseId));
    if (series.some((s) => s.points.length > 0)) {
      const names = workouts.map((w) => w.name).join(", ");
      return { kind: "chart", label: `${DAY_NAMES[d]} · ${names}`, series };
    }
  }

  return { kind: "chart", label: "Recent lifts", series: open.weightSeries };
}

function PersonalTop({
  open,
  todayDow,
  weekly,
}: {
  open: PersonWorkout;
  todayDow: number;
  weekly: WeeklyActivity[];
}) {
  const graph = useMemo(() => chooseGraph(open, todayDow), [open, todayDow]);

  return (
    <div className="space-y-5">
      {graph.kind === "chart" && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            {graph.label}
          </p>
          <LineChart
            weight
            series={graph.series.map((s) => ({
              id: s.exerciseId,
              name: s.name,
              color: s.color,
              unit: s.unit,
              points: s.points,
            }))}
          />
        </div>
      )}

      {weekly.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            This week
          </p>
          <ul className="space-y-1.5">
            {weekly.map((w) => (
              <li
                key={w.label}
                className="flex items-center justify-between rounded-xl border border-hairline bg-ground/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">{w.label}</span>
                <span className="tabular text-muted">
                  {w.count}×{w.detail ? ` · ${w.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        graph.kind === "none" && (
          <p className="rounded-xl border border-hairline bg-ground/30 p-6 text-center text-sm text-muted">
            Nothing logged this week yet.
          </p>
        )
      )}
    </div>
  );
}

function TileStatus({ person }: { person: PersonWorkout }) {
  if (person.today.rested) {
    return <span className="text-xs text-muted">Rest day taken</span>;
  }
  if (person.today.workedOut) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
        <CheckIcon className="h-3.5 w-3.5" />
        Worked out today
      </span>
    );
  }
  if (person.today.paused) {
    return (
      <span className="text-xs text-muted">Paused &mdash; {person.today.paused}</span>
    );
  }
  if (person.todayPlanned.length > 0) {
    return (
      <span className="flex flex-wrap gap-1">
        {person.todayPlanned.map((w) => (
          <span
            key={w.id}
            className="rounded-full bg-ground px-2.5 py-0.5 text-xs font-medium"
          >
            {w.name}
          </span>
        ))}
      </span>
    );
  }
  const hasPlan = person.plan.some((d) => d.workouts.length > 0);
  return (
    <span className="text-xs text-muted">
      {hasPlan ? "Rest day" : "No plan yet"}
    </span>
  );
}

type IconType = ({ className }: { className?: string }) => React.ReactElement;

// Decorative on the card (not clickable until the card is opened). Icons only,
// held a touch out of focus at rest so the tap-to-open zoom reads as pulling
// them sharp; they crisp up on hover as a "you can open this" cue.
function ActionChip({ icon: Icon }: { icon: IconType }) {
  return (
    <span className="flex flex-1 items-center justify-center rounded-xl border border-hairline/70 py-2.5 text-muted opacity-60 blur-[1px] transition duration-200 group-hover:opacity-100 group-hover:blur-0">
      <Icon className="h-5 w-5" />
    </span>
  );
}

// Clickable in the opened (larger) card.
function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: IconType;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors ${
        primary
          ? "border-accent bg-accent/10 text-accent"
          : "border-hairline text-ink hover:border-accent hover:text-accent"
      }`}
    >
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 text-sm font-medium text-accent hover:underline"
    >
      &lsaquo; Back
    </button>
  );
}

// What each workout type records, and whether it carries a load. Running,
// rowing, rucking and weights imply their metric; the rest let you choose
// between time and reps/rounds.
type CatCfg = { locked?: Metric; choices?: Metric[]; load?: boolean };
const CATEGORY_CFG: Record<WorkoutCategory, CatCfg> = {
  RUNNING: { choices: ["DISTANCE", "METERS"] },
  ROWING: { locked: "METERS" },
  RUCKING: { locked: "DISTANCE", load: true },
  WEIGHTS: { locked: "WEIGHT" },
  HIIT: { choices: ["DURATION", "REPS"] },
  SPORT: { choices: ["DURATION", "REPS"] },
  STRETCHING: { choices: ["DURATION", "REPS"] },
  ISOMETRIC: { choices: ["DURATION", "REPS"] },
};

const METRIC_LABEL: Record<Metric, string> = {
  DURATION: "Time",
  REPS: "Reps / rounds",
  DISTANCE: "Distance",
  METERS: "Meters",
  WEIGHT: "Weight",
};

function defaultMetric(cfg: CatCfg): Metric {
  return cfg.locked ?? cfg.choices?.[0] ?? "REPS";
}

function unitFor(metric: Metric, system: UnitSystem): string {
  switch (metric) {
    case "WEIGHT":
      return system === "metric" ? "kg" : "lb";
    case "DISTANCE":
      return system === "metric" ? "km" : "mi";
    case "METERS":
      return "m";
    case "REPS":
      return "rep";
    case "DURATION":
      return "";
  }
}

const CAPTION = "mb-1 block text-xs font-semibold uppercase tracking-widest text-muted";
const FIELD =
  "h-9 w-full rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";

/** YYYY-MM-DD → "Jul 21", parsed locally to avoid an off-by-one. */
function fmtHistoryDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Order shown in the log picker. Pool categories get an exercise dropdown;
// running/rowing/rucking are metric-only.
const LOG_CATEGORIES: WorkoutCategory[] = [
  "WEIGHTS",
  "HIIT",
  "RUNNING",
  "ROWING",
  "RUCKING",
  "SPORT",
  "STRETCHING",
  "ISOMETRIC",
];

export function CustomWorkoutForm({
  userId,
  unitSystem,
  pool,
  hiitWorkouts,
  dateISO,
  onDone,
}: {
  userId: string;
  unitSystem: UnitSystem;
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
  dateISO: string;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<WorkoutCategory>("WEIGHTS");
  const [poolId, setPoolId] = useState(
    () => pool.find((p) => p.category === "WEIGHTS" && p.isActive)?.id ?? "",
  );
  const [metric, setMetric] = useState<Metric>("WEIGHT");
  const [amount, setAmount] = useState(""); // reps / distance / meters / weight
  const [min, setMin] = useState("");
  const [sec, setSec] = useState("");
  const [hours, setHours] = useState(""); // sport
  const [load, setLoad] = useState(""); // ruck load
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const cfg = CATEGORY_CFG[category];
  const isPoolCat = POOL_CATEGORIES.includes(category);
  const isSport = category === "SPORT";
  const isHiit = category === "HIIT";
  const options = pool.filter((p) => p.category === category && p.isActive);
  const poolMissing = isPoolCat && options.length === 0;

  const changeCategory = (c: WorkoutCategory) => {
    setCategory(c);
    setMetric(defaultMetric(CATEGORY_CFG[c]));
    const opts = pool.filter((p) => p.category === c && p.isActive);
    setPoolId(opts[0]?.id ?? "");
  };

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const numeric = (v: string) => v.replace(/[^\d.]/g, "");
  const value = isSport
    ? Math.round(num(hours) * 3600)
    : metric === "DURATION"
      ? num(min) * 60 + num(sec)
      : num(amount);
  const selected = options.find((o) => o.id === poolId);
  const unit = isSport
    ? "h"
    : metric === "WEIGHT" && selected?.unit
      ? selected.unit
      : unitFor(metric, unitSystem);
  const loadUnit = unitSystem === "metric" ? "kg" : "lb";
  const canSave = value > 0 && !pending && (!isPoolCat || !!poolId);

  const save = () => {
    if (!canSave) return;
    startTransition(async () => {
      await logCustomWorkout({
        userId,
        dateISO,
        poolExerciseId: isPoolCat ? poolId : null,
        category: isPoolCat ? null : category,
        metric,
        value,
        unit,
        load: cfg.load ? num(load) || null : null,
        notes: notes.trim() || undefined,
      });
      onDone();
    });
  };

  const showRecordChoice = !!cfg.choices && !isSport && !isHiit;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className={showRecordChoice ? "" : "col-span-2"}>
          <label className={CAPTION}>Type</label>
          <select
            value={category}
            onChange={(e) => changeCategory(e.target.value as WorkoutCategory)}
            className={FIELD}
          >
            {LOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        {showRecordChoice && (
          <div>
            <label className={CAPTION}>Record</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className={FIELD}
            >
              {cfg.choices!.map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isHiit ? (
        <HiitBuilder
          pool={pool}
          workouts={hiitWorkouts.filter(
            (w) => w.ownerId === null || w.ownerId === userId,
          )}
          userId={userId}
          dateISO={dateISO}
          onDone={onDone}
        />
      ) : (
        <>
      {isPoolCat && (
        <div>
          <label className={CAPTION}>Exercise</label>
          {poolMissing ? (
            <p className="rounded-xl border border-hairline bg-ground/40 px-3 py-2 text-sm text-muted">
              No {CATEGORY_LABEL[category].toLowerCase()} exercises in the pool
              yet — add them in the Workouts admin.
            </p>
          ) : (
            <select
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              className={FIELD}
            >
              {category === "WEIGHTS"
                ? [...MUSCLE_GROUPS, null].map((mg) => {
                    const items = options.filter((o) => o.muscleGroup === mg);
                    if (items.length === 0) return null;
                    return (
                      <optgroup
                        key={mg ?? "other"}
                        label={mg ? MUSCLE_GROUP_LABEL[mg] : "Other"}
                      >
                        {items.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                : options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label className={CAPTION}>Result</label>
        {isSport ? (
          <div className="flex items-center gap-2">
            <input
              value={hours}
              onChange={(e) => setHours(numeric(e.target.value))}
              inputMode="decimal"
              placeholder="0"
              className={`${FIELD} w-24 text-center`}
            />
            <span className="text-sm text-muted">hours</span>
          </div>
        ) : metric === "DURATION" ? (
          <div className="flex items-center gap-2">
            <input
              value={min}
              onChange={(e) => setMin(numeric(e.target.value))}
              inputMode="numeric"
              placeholder="0"
              className={`${FIELD} w-20 text-center`}
            />
            <span className="text-sm text-muted">min</span>
            <input
              value={sec}
              onChange={(e) => setSec(numeric(e.target.value))}
              inputMode="numeric"
              placeholder="00"
              className={`${FIELD} w-20 text-center`}
            />
            <span className="text-sm text-muted">sec</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(numeric(e.target.value))}
              inputMode="decimal"
              placeholder="0"
              className={`${FIELD} w-28 text-center`}
            />
            {unit && <span className="text-sm text-muted">{unit}</span>}
          </div>
        )}
      </div>

      {cfg.load && (
        <div>
          <label className={CAPTION}>Load (optional)</label>
          <div className="flex items-center gap-2">
            <input
              value={load}
              onChange={(e) => setLoad(numeric(e.target.value))}
              inputMode="decimal"
              placeholder="0"
              className={`${FIELD} w-28 text-center`}
            />
            <span className="text-sm text-muted">{loadUnit}</span>
          </div>
        </div>
      )}

      <div>
        <label className={CAPTION}>Notes (optional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Rounds, splits, how it felt…"
          className={FIELD}
        />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {pending ? "Logging…" : "Log workout"}
      </button>
        </>
      )}
    </div>
  );
}

function HiitBuilder({
  pool,
  workouts,
  userId,
  dateISO,
  onDone,
}: {
  pool: PoolEntry[];
  workouts: BoardHiitWorkout[];
  userId: string;
  dateISO: string;
  onDone: () => void;
}) {
  // "new" builds a fresh workout (saved to this person's pool); otherwise an
  // existing named workout is picked and just its result is logged.
  const [sel, setSel] = useState("new");
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkoutType>("FOR_TIME");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [count, setCount] = useState("");
  const [min, setMin] = useState("");
  const [sec, setSec] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sharing, startShare] = useTransition();

  const movements = pool.filter((p) => p.category === "HIIT" && p.isActive);
  const hero = workouts.filter((w) => w.heroWod);
  const mine = workouts.filter((w) => w.ownerId === userId && !w.heroWod);
  const shared = workouts.filter((w) => w.ownerId === null && !w.heroWod);

  const isNew = sel === "new";
  const active = workouts.find((w) => w.id === sel) ?? null;
  const activeType: WorkoutType = isNew ? type : (active?.type ?? "FOR_TIME");
  const result = hiitResult(activeType);

  const onlyNum = (v: string) => v.replace(/[^\d.]/g, "");
  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const value =
    result.metric === "DURATION" ? num(min) * 60 + num(sec) : num(count);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSave =
    value > 0 &&
    !pending &&
    (isNew ? name.trim().length >= 2 && picked.size > 0 : !!active);

  const save = () => {
    if (!canSave) return;
    setError(null);
    startTransition(async () => {
      if (isNew) {
        const res = await createAndLogHiitWorkout({
          userId,
          dateISO,
          name: name.trim(),
          type,
          movements: [...picked].map((poolExerciseId) => ({ poolExerciseId })),
          value,
          notes: notes.trim() || undefined,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      } else if (active) {
        await logHiitWorkout({
          userId,
          dateISO,
          hiitWorkoutId: active.id,
          value,
          notes: notes.trim() || undefined,
        });
      }
      onDone();
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={CAPTION}>Workout</label>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          className={`${FIELD} w-full`}
        >
          <option value="new">+ New workout</option>
          {mine.length > 0 && (
            <optgroup label="Personal">
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
          {hero.length > 0 && (
            <optgroup label="Hero WOD">
              {hero.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {isNew ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={CAPTION}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Murph"
                className={`${FIELD} w-full px-4`}
              />
            </div>
            <div>
              <label className={CAPTION}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as WorkoutType)}
                className={`${FIELD} w-full`}
              >
                {WORKOUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORKOUT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={CAPTION}>Movements (from the HIIT pool)</label>
            {movements.length === 0 ? (
              <p className="rounded-xl border border-hairline bg-ground/40 px-3 py-2 text-sm text-muted">
                No HIIT movements in the pool yet — add them in the Workouts
                admin.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {movements.map((m) => {
                  const on = picked.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        on
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-hairline text-muted hover:border-accent"
                      }`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        active && (
          <div className="rounded-xl border border-hairline bg-ground/30 p-3 text-sm">
            <span className="font-semibold">
              {WORKOUT_TYPE_LABEL[active.type]}
            </span>
            {active.movements.length > 0 && (
              <span className="text-muted">
                {" · "}
                {active.movements
                  .map((m) => formatHiitMovement(m))
                  .join(", ")}
              </span>
            )}
            {active.ownerId === userId && !active.approved && (
              <div className="mt-2 border-t border-hairline pt-2">
                {active.shareRequested ? (
                  <span className="text-xs text-muted">
                    Share requested — waiting for a parent to approve.
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={sharing}
                    onClick={() =>
                      startShare(() => requestShareHiitWorkout(active.id))
                    }
                    className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                  >
                    Share with the family
                  </button>
                )}
              </div>
            )}
          </div>
        )
      )}

      <div>
        <label className={CAPTION}>{result.label}</label>
        {result.metric === "DURATION" ? (
          <div className="flex items-center gap-2">
            <input
              value={min}
              onChange={(e) => setMin(onlyNum(e.target.value))}
              inputMode="numeric"
              placeholder="0"
              className={`${FIELD} w-20 text-center`}
            />
            <span className="text-sm text-muted">min</span>
            <input
              value={sec}
              onChange={(e) => setSec(onlyNum(e.target.value))}
              inputMode="numeric"
              placeholder="00"
              className={`${FIELD} w-20 text-center`}
            />
            <span className="text-sm text-muted">sec</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={count}
              onChange={(e) => setCount(onlyNum(e.target.value))}
              inputMode="numeric"
              placeholder="0"
              className={`${FIELD} w-28 text-center`}
            />
            <span className="text-sm text-muted">
              {activeType === "AMRAP" ? "rounds" : "reps"}
            </span>
          </div>
        )}
      </div>

      <div>
        <label className={CAPTION}>Notes (optional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Scaling, splits, how it felt…"
          className={FIELD}
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {pending ? "Logging…" : "Log workout"}
      </button>
    </div>
  );
}
