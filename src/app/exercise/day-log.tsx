"use client";

import { PRIMARY_BTN, SECONDARY_BTN, SECONDARY_LG, SECONDARY_SM } from "./buttons";
import { Modal } from "./plan-file-panel";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  loadDayLog,
  loadMovementSets,
  loadWorkoutWeek,
  restDay,
  saveMovementFeedback,
  answerWorkoutSuggestion,
  saveMovementSets,
  skipMovement,
  checkConcept2,
  undoConcept2Row,
  setWarmup,
  type LoggedSet,
} from "@/lib/actions/workouts";
import type { Concept2Day } from "@/lib/workouts/concept2-run";
import { CardioCard } from "./cardio-card";
import { ConditioningCard } from "./conditioning-card";
import { ConditioningTimer } from "./conditioning-timer";
import { EffortPicker } from "@/components/effort-picker";
import { WarmupWindow } from "./warmup-window";
import type { WarmupRoutine } from "@/lib/workouts/warmup-library";
import { AddConditioning, BenchmarkCard, PickConditioningCard } from "./conditioning-picker";
import type { BenchmarkState, PickPlan } from "@/lib/workouts/wod-run";
import type { ConditioningPlan } from "@/lib/workouts/conditioning-run";
import type { CardioEntry } from "@/lib/workouts/cardio-run";
import type { DayLogState, MovementLog, MovementSetRow, WeekStripDay } from "@/lib/queries/workout-log";
import type { PersonWorkout, PlanExercise, PlanWorkout } from "@/lib/queries/workouts";
import {
  CARDIO_CATEGORIES,
  withCardio,
  type SectionKind,
  daySections,
  dayHeadline,
  withSection,
  dayProgress,
  stripState,
  type DayItem,
  type DayWorkoutIn,
  type StripState,
} from "@/lib/workouts/blocks";
import { fmtNumber, fmtSeconds } from "@/lib/workouts/sets";
import { type Effort, type HurtArea, type Metric, type UnitSystem } from "@/lib/workouts/catalog";
import { isNewBest, recordChips } from "@/lib/workouts/records";
import { bigJump, type Suggestion } from "@/lib/workouts/suggest";
import { addDays, dayOfWeek } from "@/lib/dates";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  DumbbellIcon,
  TimerIcon,
  MoonIcon,
  PlusIcon,
  SwapIcon,
  XIcon,
} from "@/components/icons";
import { MovementInfo } from "@/components/movement-info";
import { PlanRow, PlanActionTile, SwapPicker, type PoolPick } from "./workout-card";
import { WeightCalculator } from "./weight-calculator";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_LONG[dayOfWeek(iso)]}, ${MONTH[m - 1]} ${d}`;
}

type OpenMovement = {
  workoutId: string;
  exercise: PlanExercise;
  metric: Metric;
};

/**
 * The day page: a week strip, any missed days still open, then the day's
 * sections (Warm-up, Cardio, each muscle group, Conditioning). A movement
 * opens its own page to log every set; warm-up, cardio and HIIT keep the card
 * they had. Any day in the strip can be opened; a past day logs late (it
 * counts for that day, recorded as done today), the same rule as the old
 * Overdue list.
 */
export function DayLog({
  person,
  todayISO,
  unitSystem,
  extra,
  initialDate,
  writeOwn,
}: {
  person: PersonWorkout;
  todayISO: string;
  unitSystem: UnitSystem;
  /** Rendered under the day (the "log an additional workout" form). */
  extra?: (dateISO: string) => React.ReactNode;
  /** The day it opens on (a home-page prompt carried over from an earlier day). */
  initialDate?: string;
  /** "Write your own" conditioning for the day (the workout builder). */
  writeOwn?: (dateISO: string, onDone: () => void) => React.ReactNode;
}) {
  const userId = person.user.id;
  const [date, setDate] = useState(initialDate && initialDate <= todayISO ? initialDate : todayISO);
  const [data, setData] = useState<{
    state: DayLogState;
    loggedByPool: Record<string, LoggedSet>;
    order: SectionKind[];
    cardio: CardioEntry[];
    conditioning: ConditioningPlan[];
    picks: PickPlan[];
    benchmark: BenchmarkState;
    conditioningDone: { name: string; result: string | null }[];
    warmups?: { plannedWorkoutId: string; routine: WarmupRoutine | null }[];
  } | null>(null);
  const [week, setWeek] = useState<{ days: WeekStripDay[]; overdue: string[]; today: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<OpenMovement | null>(null);
  const [, startTransition] = useTransition();
  const [c2, setC2] = useState<Concept2Day | null>(null);
  const [c2Checking, setC2Checking] = useState(false);

  // Concept2: checked when the day opens, every 15 minutes while it's open,
  // and on "Check now". New rows reload the day (the Cardio block counts done).
  const checkC2 = useCallback(
    (force: boolean) => {
      if (force) setC2Checking(true);
      checkConcept2(userId, date, force)
        .then((r) => {
          setC2(r.day);
          setData((cur) => (cur ? { ...cur, cardio: r.cardio } : cur));
          if (r.added > 0) setTick((n) => n + 1);
        })
        .catch(() => undefined)
        .finally(() => force && setC2Checking(false));
    },
    [userId, date],
  );
  useEffect(() => {
    checkC2(false);
    const t = setInterval(() => checkC2(false), 15 * 60_000);
    return () => clearInterval(t);
  }, [checkC2]);
  const undoC2 = (resultId: string) =>
    startTransition(async () => {
      await undoConcept2Row(userId, resultId).catch(() => undefined);
      checkC2(false);
      setTick((n) => n + 1);
    });

  // Reload when the date changes, after a movement closes, and whenever the
  // page's own data refreshes (a card logged or skipped through its action).
  useEffect(() => {
    let live = true;
    setFailed(false);
    loadDayLog(userId, date)
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    loadWorkoutWeek(userId)
      .then((w) => live && setWeek(w))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [userId, date, tick, person]);

  // A past day shows the plan entries that existed then (v0.623): one made
  // later (a program started since) wasn't that day's plan.
  const planIds = data?.state.planIds;
  const workouts: PlanWorkout[] = useMemo(
    () =>
      (person.plan[dayOfWeek(date)]?.workouts ?? []).filter(
        (w) => !w.isRest && (date >= todayISO || !planIds || planIds.includes(w.id)),
      ),
    [person.plan, date, todayISO, planIds],
  );
  const byId = useMemo(() => new Map(workouts.map((w) => [w.id, w])), [workouts]);
  const order = data?.order;
  const cardioCount = data?.cardio.length ?? 0;
  const sections = useMemo(
    () =>
      withCardio(
        daySections(
          workouts.map((w): DayWorkoutIn => ({
            id: w.id,
            name: w.name,
            category: w.category,
            muscleGroup: w.muscleGroup,
            isRest: w.isRest,
            hasHiit: !!w.hiit,
            movements: w.exercises.map((e) => ({
              poolExerciseId: e.poolExerciseId,
              name: e.name,
              tracked: e.tracked,
              metric: e.metric,
            })),
          })),
          order,
        ),
        cardioCount > 0,
        order,
      ),
    [workouts, order, cardioCount],
  );

  const state = data?.state ?? null;
  const cardDone = useCallback(
    (workoutId: string) => {
      if (!state) return false;
      const w = byId.get(workoutId);
      if (state.doneWorkouts.includes(workoutId) || state.skippedPlans.includes(`plan:${workoutId}`)) return true;
      // Cardio (and an older Rowing / Running / Rucking plan) is done by any
      // cardio that day.
      if (w?.category && CARDIO_CATEGORIES.includes(w.category)) return state.cardioLogged;
      // Conditioning picked on the day: done by any conditioning (v0.617).
      if (w?.category === "HIIT" && !w.hiit && w.exercises.length === 0) return state.hiitLogged;
      // A plan with nothing to enter (a run, a stretch) is done once its
      // session exists, matched by name as the old card did.
      return !!w && state.sessionNames.some((n) => n.trim().toLowerCase() === w.name.trim().toLowerCase());
    },
    [state, byId],
  );
  const isDone = useCallback(
    (it: DayItem) => {
      if (!state) return false;
      if (it.type === "movement") {
        const m = state.movements[it.poolExerciseId];
        return !!m && (m.setCount > 0 || m.skipped);
      }
      if (it.type === "card") return cardDone(it.workoutId);
      return false;
    },
    [state, cardDone],
  );
  // A Conditioning section is always there, so + Conditioning sits where the
  // person's order puts conditioning, even on a day with none planned (v0.625).
  const withConditioning = useMemo(() => withSection(sections, "CONDITIONING", order), [sections, order]);
  const progress = dayProgress(sections, isDone);
  const late = date < todayISO;
  const completedOnISO = late ? todayISO : undefined;
  const openDays = (week?.overdue ?? []).filter((d) => d !== date);

  if (open) {
    return (
      <MovementLogger
        key={`${date}:${open.workoutId}:${open.exercise.poolExerciseId}`}
        userId={userId}
        dateISO={date}
        late={late}
        workoutId={open.workoutId}
        exercise={open.exercise}
        metric={open.metric}
        completedOnISO={completedOnISO}
        onBack={() => {
          setOpen(null);
          setTick((n) => n + 1);
        }}
      />
    );
  }

  // The program and its main lift on a program day, else the kinds of work.
  const title = state?.programTitle ?? state?.program?.name ?? dayHeadline(sections);

  return (
    <div className="space-y-5">
      {week && (
        <WeekStrip
          days={week.days}
          overdue={week.overdue}
          today={week.today}
          selected={date}
          onPick={(d) => setDate(d)}
        />
      )}
      <label className="flex items-center justify-end gap-2 text-xs text-muted">
        Another day
        <input
          type="date"
          value={date}
          max={todayISO}
          min={addDays(todayISO, -90)}
          onChange={(e) => {
            const v = e.target.value;
            if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= todayISO) setDate(v);
          }}
          className="tabular h-9 rounded-full border border-hairline bg-surface px-3 text-xs text-ink outline-none focus:border-accent"
        />
      </label>

      {openDays.map((d) => (
        <div
          key={d}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3"
        >
          <p className="min-w-[12rem] flex-1 text-sm font-medium text-amber-900">
            {WEEKDAY_LONG[dayOfWeek(d)]}&rsquo;s workout isn&rsquo;t logged
          </p>
          <button
            type="button"
            onClick={() => setDate(d)}
            className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent transition-all hover:brightness-110"
          >
            Log it
          </button>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await restDay(userId, d);
                setTick((n) => n + 1);
              })
            }
            className="inline-flex h-10 items-center rounded-full border border-amber-300 px-4 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Skip it
          </button>
        </div>
      ))}

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          {date === todayISO ? "Today" : dayLabel(date)}
          {late && workouts.length > 0 && !state?.loggedAny && " · logging late"}
          {state?.program && ` · ${state.program.label}`}
        </p>
        <h3 className="mt-1 font-display text-xl font-semibold">
          {state?.rested
            ? "Rest day"
            : title ||
              (workouts.length === 0
                ? state?.loggedTitle || "Nothing planned"
                : "Workout")}
        </h3>
        {progress.total > 0 && !state?.rested && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline" aria-hidden>
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <span className="tabular text-xs text-muted">
              {progress.done} of {progress.total} done
            </span>
          </div>
        )}
        {/* Resting or skipping the whole day lives here, with the day (v0.624). */}
        {data && !state?.rested && !state?.loggedAny && (
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await restDay(userId, date);
                setTick((n) => n + 1);
              })
            }
            className={`${SECONDARY_BTN} mt-3`}
          >
            <MoonIcon className="h-4 w-4" />
            Rest / skip day
          </button>
        )}
      </div>

      {state?.light && !state.rested && (
        <p className="text-sm font-semibold text-accent">
          Lighter today · {Math.round(state.light * 100)}% of the usual weights
        </p>
      )}

      {state?.suggestion && !state.rested && (
        <SuggestionCard
          s={state.suggestion}
          onAnswer={(answer) => {
            const key = state.suggestion!.key;
            setData((cur) => (cur ? { ...cur, state: { ...cur.state, suggestion: null } } : cur));
            void answerWorkoutSuggestion({ userId, dateISO: date, key, answer })
              .then(() => setTick((n) => n + 1))
              .catch(() => {});
          }}
        />
      )}

      {data?.benchmark && !state?.rested && (
        <BenchmarkCard
          key={`bench:${date}`}
          userId={userId}
          dateISO={date}
          completedOnISO={completedOnISO}
          benchmark={data.benchmark}
          onChanged={() => setTick((n) => n + 1)}
        />
      )}

      {failed && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Couldn&rsquo;t load this day. Try again.</p>
      )}

      {!data && !failed ? (
        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">Loading&hellip;</p>
      ) : (
        data &&
        !state?.rested && (
          <div className="space-y-5">
            {withConditioning.map((s) => (
              <section key={s.key}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{s.title}</h4>
                <div className="space-y-2">
                  {s.kind === "CARDIO" && (
                    <CardioCard
                      key={`cardio:${date}`}
                      userId={userId}
                      dateISO={date}
                      completedOnISO={completedOnISO}
                      unitSystem={unitSystem}
                      entries={data.cardio}
                      onEntries={(cardio) => {
                        setData((cur) => (cur ? { ...cur, cardio } : cur));
                        setTick((n) => n + 1);
                      }}
                      c2={c2}
                      c2Checking={c2Checking}
                      onCheckC2={() => checkC2(true)}
                      onUndoC2={undoC2}
                      name={workouts.find((w) => w.category === "CARDIO")?.name ?? "Cardio"}
                      skip={(() => {
                        const plan = workouts.find((w) => w.category === "CARDIO");
                        if (!plan) return undefined;
                        return {
                          skipped: state?.skippedPlans.includes(`plan:${plan.id}`) ?? false,
                          onToggle: (v: boolean) =>
                            startTransition(async () => {
                              await skipMovement({
                                userId,
                                dateISO: date,
                                plannedWorkoutId: plan.id,
                                poolExerciseId: "",
                                skipped: v,
                              });
                              setTick((n) => n + 1);
                            }),
                        };
                      })()}
                    />
                  )}
                  {s.items.map((it) => {
                    if (it.type === "card") {
                      const w = byId.get(it.workoutId);
                      if (!w) return null;
                      // Cardio plans are the card above.
                      if (w.category && CARDIO_CATEGORIES.includes(w.category)) return null;
                      const cond = w.hiit ? data.conditioning.find((c) => c.plannedWorkoutId === w.id) : undefined;
                      if (cond) {
                        return (
                          <ConditioningCard
                            key={`${date}:${w.id}`}
                            userId={userId}
                            dateISO={date}
                            workout={cond}
                            skipped={state?.skippedPlans.includes(`plan:${w.id}`) ?? false}
                            onChanged={() => setTick((n) => n + 1)}
                          />
                        );
                      }
                      const pick = data.picks.find((p) => p.plannedWorkoutId === w.id);
                      if (pick) {
                        return (
                          <PickConditioningCard
                            key={`${date}:${w.id}`}
                            userId={userId}
                            dateISO={date}
                            completedOnISO={completedOnISO}
                            plan={pick}
                            skipped={state?.skippedPlans.includes(`plan:${w.id}`) ?? false}
                            onChanged={() => setTick((n) => n + 1)}
                            writeOwn={writeOwn}
                          />
                        );
                      }
                      if (w.category === "WARMUP") {
                        const done = cardDone(w.id);
                        return (
                          <WarmupRow
                            key={`${date}:${w.id}`}
                            userId={userId}
                            plannedWorkoutId={w.id}
                            name={w.name}
                            routine={data.warmups?.find((x) => x.plannedWorkoutId === w.id)?.routine ?? null}
                            onChanged={() => setTick((n) => n + 1)}
                            done={done}
                            skipped={state?.skippedPlans.includes(`plan:${w.id}`) ?? false}
                            onDone={(v) =>
                              startTransition(async () => {
                                await setWarmup({
                                  userId,
                                  dateISO: date,
                                  plannedWorkoutId: w.id,
                                  done: v,
                                  completedOnISO,
                                });
                                setTick((n) => n + 1);
                              })
                            }
                            onSkip={(v) =>
                              startTransition(async () => {
                                await skipMovement({
                                  userId,
                                  dateISO: date,
                                  plannedWorkoutId: w.id,
                                  poolExerciseId: "",
                                  skipped: v,
                                });
                                setTick((n) => n + 1);
                              })
                            }
                          />
                        );
                      }
                      return (
                        <PlanRow
                          key={`${date}:${w.id}`}
                          workout={w}
                          userId={userId}
                          dateISO={date}
                          unitSystem={unitSystem}
                          done={cardDone(w.id)}
                          loggedByPool={data.loggedByPool}
                          completedOnISO={completedOnISO}
                        />
                      );
                    }
                    if (it.type === "untracked") {
                      return (
                        <div
                          key={`${it.workoutId}:${it.poolExerciseId}`}
                          className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3"
                        >
                          <span className="flex-1 text-sm font-medium">{it.name}</span>
                          <span className="text-xs text-muted">No log needed</span>
                        </div>
                      );
                    }
                    const w = byId.get(it.workoutId);
                    const ex = w?.exercises.find((e) => e.poolExerciseId === it.poolExerciseId);
                    if (!ex) return null;
                    const m = data.state.movements[it.poolExerciseId];
                    const logged = !!m && m.setCount > 0;
                    const skipped = !!m?.skipped && !logged;
                    const detail = logged
                      ? `${m.loggedAs ? `${m.loggedAs} · ` : ""}${m.summary}`
                      : skipped
                        ? "Skipped today"
                        : m?.last
                          ? `Last time ${m.last}`
                          : "Not logged yet";
                    return (
                      <button
                        key={`${it.workoutId}:${it.poolExerciseId}`}
                        type="button"
                        onClick={() => setOpen({ workoutId: it.workoutId, exercise: ex, metric: it.metric })}
                        className="flex min-h-[3.5rem] w-full items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-left transition-colors hover:border-accent"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{it.name}</span>
                          <span className="tabular block truncate text-xs text-muted">{detail}</span>
                        </span>
                        {logged && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            Logged
                          </span>
                        )}
                        {skipped && (
                          <span className="rounded-full border border-hairline bg-ground px-2.5 py-0.5 text-xs font-semibold text-muted">
                            Skipped
                          </span>
                        )}
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
                      </button>
                    );
                  })}
                  {/* The day's Conditioning section, where the person's order puts
                      it (v0.625): one-offs logged, then + Conditioning. */}
                  {s.kind === "CONDITIONING" && (
                    <>
                      {(() => {
                        // Conditioning done today that no card above shows: a one-off.
                        if (data.picks.length > 0) return null;
                        const planned = new Set(data.conditioning.map((c) => c.name.slice(0, 40)));
                        const extra = data.conditioningDone.filter((c) => !planned.has(c.name.slice(0, 40)));
                        return extra.length > 0 ? (
                          <ul className="space-y-1 rounded-xl border border-hairline bg-surface px-4 py-3 text-sm">
                            {extra.map((c, i) => (
                              <li key={i}>
                                <span className="font-medium">{c.name}</span>
                                {c.result && <span className="tabular text-muted"> · {c.result}</span>}
                              </li>
                            ))}
                          </ul>
                        ) : null;
                      })()}
                      <AddConditioning
                        key={`addc:${date}`}
                        userId={userId}
                        dateISO={date}
                        completedOnISO={completedOnISO}
                        onChanged={() => setTick((n) => n + 1)}
                        writeOwn={writeOwn}
                      />
                    </>
                  )}
                </div>
              </section>
            ))}
          </div>
        )
      )}

      {(state?.loggedOther?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Logged</p>
          {state!.loggedOther.map((g) => (
            <div key={g.name} className="rounded-xl border border-hairline bg-surface px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CheckIcon className="h-4 w-4 text-accent" />
                {g.name}
              </p>
              <ul className="mt-1 space-y-0.5 pl-6 text-sm">
                {g.lines.map((l, i) => (
                  <li key={i}>
                    {l.name !== g.name && <span>{l.name} · </span>}
                    <span className="tabular text-muted">{l.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {extra && <div className="border-t border-hairline pt-5">{extra(date)}</div>}
    </div>
  );
}

/** A Warm-up in the plan: done with a tap (tap again to undo), or skipped. */
function WarmupRow({
  userId,
  plannedWorkoutId,
  name,
  routine,
  onChanged,
  done,
  skipped,
  onDone,
  onSkip,
}: {
  userId: string;
  plannedWorkoutId: string;
  name: string;
  /** Its routine (v0.622): tapping the card opens it; null is a plain check. */
  routine: WarmupRoutine | null;
  onChanged: () => void;
  done: boolean;
  skipped: boolean;
  onDone: (done: boolean) => void;
  onSkip: (skipped: boolean) => void;
}) {
  const finished = done && !skipped;
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[3.5rem] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3">
      <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold">{name}</span>
        {routine && <span className="block truncate text-xs text-muted">{routine.name}</span>}
      </button>
      {open && (
        <WarmupWindow
          userId={userId}
          plannedWorkoutId={plannedWorkoutId}
          routine={routine}
          done={finished}
          onDone={() => {
            onDone(true);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          onChanged={onChanged}
        />
      )}
      {!finished && (
        <button
          type="button"
          aria-pressed={skipped}
          onClick={() => onSkip(!skipped)}
          className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold ${
            skipped ? "border-hairline bg-ground text-muted" : "border-hairline text-muted hover:border-accent"
          }`}
        >
          {skipped ? "Skipped" : "Skip"}
        </button>
      )}
      {!skipped && (
        // A hollow check in the accent colour that fills in once done (v0.629);
        // the card itself opens the routine.
        <button
          type="button"
          aria-pressed={finished}
          aria-label={finished ? `${name} done` : `Mark ${name} done`}
          onClick={() => onDone(!finished)}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-accent transition-colors ${
            finished ? "bg-accent text-on-accent" : "bg-surface text-accent hover:bg-accent/10"
          }`}
        >
          <CheckIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

const STRIP_LOOK: Record<StripState, { dot: string; label: string }> = {
  done: { dot: "bg-accent border-accent", label: "done" },
  partial: {
    dot: "border-accent bg-[linear-gradient(90deg,var(--color-accent)_50%,transparent_50%)]",
    label: "partly done",
  },
  rest: { dot: "border-transparent bg-transparent", label: "rest" },
  open: { dot: "border-amber-500 bg-transparent", label: "not logged yet" },
  expired: { dot: "border-hairline bg-hairline", label: "missed" },
  today: { dot: "border-accent bg-transparent", label: "today" },
  none: { dot: "border-transparent bg-transparent", label: "nothing planned" },
};

function WeekStrip({
  days,
  overdue,
  today,
  selected,
  onPick,
}: {
  days: WeekStripDay[];
  overdue: string[];
  today: string;
  selected: string;
  onPick: (d: string) => void;
}) {
  const open = new Set(overdue);
  return (
    <div className="grid grid-cols-8 gap-1" role="group" aria-label="This week">
      {days.map((d) => {
        const st = stripState(d, today, open);
        const look = STRIP_LOOK[st];
        const on = d.date === selected;
        const [, , dd] = d.date.split("-").map(Number);
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onPick(d.date)}
            aria-pressed={on}
            aria-label={`${WEEKDAY_LONG[dayOfWeek(d.date)]} ${dd}, ${look.label}`}
            className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl border text-xs transition-colors ${
              on ? "border-accent bg-accent/5" : "border-transparent hover:bg-ground"
            }`}
          >
            <span className="text-[0.65rem] font-semibold uppercase text-muted">
              {d.date === today ? "Today" : WEEKDAY[dayOfWeek(d.date)]}
            </span>
            <span className="tabular font-semibold">{dd}</span>
            {st === "rest" ? (
              <span className="h-0.5 w-2.5 rounded-full bg-muted" aria-hidden />
            ) : (
              <span className={`h-2.5 w-2.5 rounded-full border-2 ${look.dot}`} aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

type Row = {
  key: number;
  /** What's typed; "" shows the hint. */
  w: string;
  r: string;
  s: string;
  /** Last time's (or the set above's) values, shown greyed. */
  hintW: number | null;
  hintR: number | null;
  hintS: number | null;
  /** Ticked and sent to the server. */
  saved: boolean;
  /** Added today, so it has no "last time" of its own. */
  added: boolean;
  /** The program's top set (work up to a top set). */
  top?: boolean;
  /** A 5/3/1 set's share of the training max (v0.619). */
  pct?: number;
  /** A 5/3/1 "+" set: as many good reps as you can (v0.620). */
  plus?: boolean;
  /** A warm-up set before the main sets (v0.621). */
  warmup?: boolean;
  /** A supplemental set after the main sets (BBB, FSL; v0.623). */
  supplemental?: boolean;
};

const num = (v: string): number | null => {
  const n = Number(v.trim());
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

function rowsFrom(log: MovementLog): Row[] {
  const last = log.last?.sets ?? [];
  // A program's targets fill the hints in place of last time; a target with no
  // weight yet (no training max) falls back to last time's weight.
  const target = log.target?.sets ?? [];
  let k = 0;
  if (log.sets.length > 0) {
    const done: Row[] = log.sets.map((s, i) => ({
      key: k++,
      w: s.weight != null ? fmtNumber(s.weight) : "",
      r: s.reps != null ? String(s.reps) : "",
      s: s.seconds != null ? String(s.seconds) : "",
      hintW: target[i] ? (target[i].weight ?? last[i]?.weight ?? null) : (last[i]?.weight ?? null),
      hintR: target[i] ? target[i].reps : (last[i]?.reps ?? null),
      hintS: last[i]?.seconds ?? null,
      saved: true,
      added: i >= Math.max(last.length, target.length),
      top: target[i]?.top,
      pct: target[i]?.pct,
      plus: target[i]?.plus,
      warmup: target[i]?.warmup,
      supplemental: target[i]?.supplemental,
    }));
    // The sets still to do stay after the ones logged (v0.631): leaving early
    // (or an accidental Log) never takes the rest of the workout with it.
    const rest = target.slice(done.length).map((t, j) => {
      const i = done.length + j;
      return {
        key: k++,
        w: "",
        r: "",
        s: "",
        hintW: t.weight ?? last[i]?.weight ?? null,
        hintR: t.reps,
        hintS: last[i]?.seconds ?? null,
        saved: false,
        added: false,
        top: t.top,
        pct: t.pct,
        plus: t.plus,
        warmup: t.warmup,
        supplemental: t.supplemental,
      };
    });
    return [...done, ...rest];
  }
  if (target.length > 0) {
    return target.map((t, i) => ({
      key: k++,
      w: "",
      r: "",
      s: "",
      hintW: t.weight ?? last[i]?.weight ?? null,
      hintR: t.reps,
      hintS: last[i]?.seconds ?? null,
      saved: false,
      added: false,
      top: t.top,
      pct: t.pct,
      plus: t.plus,
      warmup: t.warmup,
      supplemental: t.supplemental,
    }));
  }
  if (last.length > 0) {
    return last.map((s) => ({
      key: k++,
      w: "",
      r: "",
      s: "",
      hintW: s.weight,
      hintR: s.reps,
      hintS: s.seconds,
      saved: false,
      added: false,
    }));
  }
  return [{ key: 0, w: "", r: "", s: "", hintW: null, hintR: null, hintS: null, saved: false, added: true }];
}

function lastText(s: MovementSetRow | undefined, metric: Metric): string {
  if (!s) return "";
  if (metric === "DURATION") return s.seconds != null ? fmtSeconds(s.seconds) : "";
  if (metric === "REPS") return s.reps != null ? `${s.reps}` : "";
  if (s.weight == null) return "";
  return s.reps != null ? `${fmtNumber(s.weight)} × ${s.reps}` : fmtNumber(s.weight);
}

/**
 * One movement, every set. Last time's sets fill each box as a greyed hint;
 * typing replaces only that box. ✓ saves the set straight away (the movement
 * is sent whole each time, so it's safe to repeat). Removing a saved set asks
 * first. "Remaining sets" moves the hints of sets not entered yet, never what
 * was typed. Log finishes: it saves anything typed but not ticked, then goes
 * back to the day.
 */
function MovementLogger({
  userId,
  dateISO,
  late,
  workoutId,
  exercise,
  metric,
  completedOnISO,
  onBack,
}: {
  userId: string;
  dateISO: string;
  late: boolean;
  workoutId: string;
  exercise: PlanExercise;
  metric: Metric;
  completedOnISO?: string;
  onBack: () => void;
}) {
  const slotId = exercise.poolExerciseId;
  const unit = metric === "WEIGHT" ? exercise.unit || "lb" : metric === "REPS" ? "reps" : "sec";
  const step = unit === "kg" ? 2.5 : 5;

  const [log, setLog] = useState<MovementLog | null>(null);
  const [failed, setFailed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [shift, setShift] = useState(0);
  const [doing, setDoing] = useState<{ id: string; name: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirmKey, setConfirmKey] = useState<number | null>(null);
  const [calcKey, setCalcKey] = useState<number | null>(null);
  // A timed movement's timer, for this set (v0.619): its time fills the set.
  const [timerKey, setTimerKey] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [leaving, setLeaving] = useState(false);
  // Log with sets still to do asks first (v0.631): finishing early keeps them.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [effort, setEffort] = useState<Effort | null>(null);
  const [hurt, setHurt] = useState<HurtArea | null>(null);
  const [sugg, setSugg] = useState<Suggestion | null>(null);
  const nextKey = useRef(100);
  const latest = useRef<Row[]>([]);
  latest.current = rows;

  useEffect(() => {
    let live = true;
    loadMovementSets(userId, dateISO, slotId)
      .then((l) => {
        if (!live) return;
        setLog(l);
        setRows(rowsFrom(l));
        setSkipped(l.skipped);
        setSugg(l.suggestion ?? null);
        setEffort((l.feedback?.effort as Effort | null) ?? null);
        setHurt((l.feedback?.hurt as HurtArea | null) ?? null);
        if (l.loggedAs) setDoing({ id: l.loggedAs.poolExerciseId, name: l.loggedAs.name });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [userId, dateISO, slotId]);

  const hintW = (r: Row) => (r.hintW != null && r.w === "" && !r.saved ? r.hintW + shift : r.hintW);
  const valueOf = (r: Row) => ({
    weight: metric === "WEIGHT" ? (num(r.w) ?? hintW(r)) : null,
    reps: metric === "WEIGHT" || metric === "REPS" ? (num(r.r) ?? r.hintR) : null,
    seconds: metric === "DURATION" ? (num(r.s) ?? r.hintS) : null,
  });
  const complete = (r: Row) => {
    const v = valueOf(r);
    return metric === "WEIGHT" ? v.weight != null : metric === "REPS" ? v.reps != null : v.seconds != null;
  };
  const typed = (r: Row) => r.w !== "" || r.r !== "" || r.s !== "";

  // Every save sends the movement's saved sets, in order.
  const persist = async (next: Row[], final = false) => {
    setStatus("saving");
    try {
      const res = await saveMovementSets({
        userId,
        dateISO,
        plannedWorkoutId: workoutId,
        slotId,
        loggedId: doing?.id ?? slotId,
        metric,
        unit,
        sets: next.filter((r) => r.saved).map(valueOf),
        completedOnISO: completedOnISO ?? null,
        final,
      });
      setStatus(res.ok ? "saved" : "error");
      return res.ok;
    } catch {
      setStatus("error");
      return false;
    }
  };

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const tick = (r: Row) => {
    let next: Row[];
    if (r.saved) {
      next = rows.map((x) => (x.key === r.key ? { ...x, saved: false } : x));
    } else {
      if (!complete(r)) return;
      const v = valueOf(r);
      next = rows.map((x) =>
        x.key === r.key
          ? {
              ...x,
              saved: true,
              w: v.weight != null ? fmtNumber(v.weight) : x.w,
              r: v.reps != null ? String(v.reps) : x.r,
              s: v.seconds != null ? String(v.seconds) : x.s,
            }
          : x,
      );
    }
    setRows(next);
    void persist(next);
  };

  const remove = (r: Row) => {
    const next = rows.filter((x) => x.key !== r.key);
    setRows(next);
    setConfirmKey(null);
    if (r.saved) void persist(next);
  };

  const addSet = () => {
    const prev = rows[rows.length - 1];
    const v = prev ? valueOf(prev) : { weight: null, reps: null, seconds: null };
    setRows([
      ...rows,
      {
        key: nextKey.current++,
        w: "",
        r: "",
        s: "",
        hintW: v.weight != null ? v.weight - shift : null,
        hintR: v.reps,
        hintS: v.seconds,
        saved: false,
        added: true,
      },
    ]);
  };

  const sameAsLast = () => {
    const next = rows.map((r) => {
      if (!complete(r)) return r;
      const v = valueOf(r);
      return {
        ...r,
        saved: true,
        w: v.weight != null ? fmtNumber(v.weight) : "",
        r: v.reps != null ? String(v.reps) : "",
        s: v.seconds != null ? String(v.seconds) : "",
      };
    });
    setRows(next);
    void persist(next);
  };

  // Log and Back both keep what was entered: anything typed (but not ticked)
  // is saved on the way out. Log is the explicit "done with this movement".
  const leave = async () => {
    setLeaving(true);
    const cur = latest.current;
    const next = cur.map((r) => (!r.saved && typed(r) && complete(r) ? { ...r, saved: true } : r));
    const changed = next.some((r, i) => r.saved !== cur[i].saved);
    if (changed || cur.some((r) => r.saved)) await persist(next, true);
    onBack();
  };

  const toggleSkip = async () => {
    const want = !skipped;
    setSkipped(want);
    try {
      await skipMovement({ userId, dateISO, plannedWorkoutId: workoutId, poolExerciseId: slotId, skipped: want });
    } catch {
      setSkipped(!want);
    }
  };

  const swapTo = async (p: PoolPick | null) => {
    setPicking(false);
    setDoing(p ? { id: p.id, name: p.name } : null);
    try {
      const l = await loadMovementSets(userId, dateISO, slotId, p?.id ?? slotId);
      const last = l.last?.sets ?? [];
      setRows((rs) =>
        rs.map((r, i) =>
          r.saved || typed(r)
            ? r
            : { ...r, hintW: last[i]?.weight ?? null, hintR: last[i]?.reps ?? null, hintS: last[i]?.seconds ?? null },
        ),
      );
      setLog((cur) => (cur ? { ...cur, last: l.last, records: l.records } : l));
    } catch {
      /* keep the old hints */
    }
  };

  // How it felt / what hurt: the whole answer each time.
  const saveFeedback = (e: Effort | null, h: HurtArea | null) => {
    setEffort(e);
    setHurt(h);
    void saveMovementFeedback({ userId, dateISO, slot: slotId, effort: e, hurt: h }).catch(() => {});
  };

  // A suggestion's answer: "use" puts its weight in the top set's hint, "swap"
  // opens the picker, "programs" goes back to the day. Each hides it for today.
  const answerSugg = (answer: string) => {
    const s = sugg;
    if (!s) return;
    setSugg(null);
    void answerWorkoutSuggestion({ userId, dateISO, key: s.key, slot: slotId, answer }).catch(() => {});
    if (answer === "use" && s.weight != null) {
      const open = rows.filter((r) => !r.saved && r.w === "" && r.hintW != null);
      const max = Math.max(...open.map((r) => r.hintW as number));
      setRows((rs) =>
        rs.map((r) => (open.includes(r) && r.hintW === max ? { ...r, hintW: (s.weight as number) - shift } : r)),
      );
    } else if (answer === "swap") {
      setPicking(true);
    } else if (answer === "programs") {
      void leave();
    }
  };

  const records = log?.records ?? [];
  // Today's heaviest at each exact rep count, from what's saved or typed.
  const todayAt = new Map<number, number>();
  for (const r of rows) {
    if (!r.saved && !typed(r)) continue;
    const v = valueOf(r);
    if (v.weight != null && v.reps != null) todayAt.set(v.reps, Math.max(todayAt.get(v.reps) ?? 0, v.weight));
  }
  const chips = metric === "WEIGHT" ? recordChips(records) : [];

  const anyEntered = rows.some((r) => r.saved || typed(r));
  const canLog = rows.some((r) => r.saved || (typed(r) && complete(r)));
  const calcRow = rows.find((r) => r.key === calcKey) ?? null;
  const nextUnsaved = rows.find((r) => !r.saved) ?? rows[rows.length - 1];
  const lastSets = log?.last?.sets ?? [];
  const hasHints = rows.some((r) => r.hintW != null || r.hintR != null || r.hintS != null);
  // A program that fixes each set's weight (5/3/1): no removing sets and no
  // moving the remaining weights (v0.619).
  const strict = rows.some((r) => r.pct != null);
  const groupOf = (r: Row) => (r.warmup ? "warm" : r.supplemental ? "supp" : "main");
  const grouped = rows.some((r) => r.warmup || r.supplemental);
  // "5 × 10" (Boring But Big) or "5 × 5" (First Set Last).
  const suppRows = rows.filter((r) => r.supplemental);
  const suppLabel = suppRows.length ? `${suppRows.length} × ${suppRows[0].hintR ?? ""}` : "";
  const cols =
    metric === "WEIGHT"
      ? "grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem] sm:grid-cols-[2rem_5.5rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem]"
      : "grid-cols-[2rem_minmax(0,1fr)_2.75rem_2.75rem] sm:grid-cols-[2rem_5.5rem_minmax(0,1fr)_2.75rem_2.75rem]";

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={leave}
        disabled={leaving}
        className="inline-flex min-h-[2.75rem] items-center gap-1.5 text-sm font-semibold text-accent"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {late ? dayLabel(dateISO) : "Today"}
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-display text-xl font-semibold">
          {doing ? doing.name : exercise.name}
          {doing && <span className="ml-2 text-sm font-normal text-muted">instead of {exercise.name}</span>}
        </h3>
        <MovementInfo
          name={doing ? doing.name : exercise.name}
          about={log && log.name === (doing ? doing.name : exercise.name) ? log.about : null}
          className="-ml-2"
        />
        <button
          type="button"
          onClick={() => (doing ? swapTo(null) : setPicking(true))}
          className={SECONDARY_SM}
        >
          <SwapIcon className="h-3.5 w-3.5" />
          {doing ? "Undo swap" : "Swap"}
        </button>
        <span className="ml-auto text-xs text-muted" aria-live="polite">
          {status === "saving"
            ? "Saving…"
            : status === "saved"
              ? "Saved"
              : status === "error"
                ? "Not saved. Try again."
                : log?.last
                  ? `Last time ${log.last.date.slice(5).replace("-", "/")}`
                  : ""}
        </span>
      </div>

      {sugg && !skipped && <SuggestionCard s={sugg} onAnswer={answerSugg} />}

      {log?.target && (
        <p className="text-sm">
          <span className="font-semibold text-muted">Today</span>{" "}
          <span className="font-semibold">{log.target.scheme}</span>
          {log.target.title && <span className="text-muted"> · {log.target.title}</span>}
        </p>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Best weight by reps">
          {chips.map((c) => {
            const now = todayAt.get(c.reps);
            const beat = now != null && now > c.weight;
            return (
              <span
                key={c.reps}
                className={`tabular inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  beat ? "border-emerald-200 bg-emerald-50" : "border-hairline bg-surface"
                }`}
              >
                <span className="text-muted">
                  {c.reps} {c.reps === 1 ? "rep" : "reps"}
                </span>
                <span className={`font-bold ${beat ? "text-emerald-700" : "text-ink"}`}>
                  {fmtNumber(beat ? (now as number) : c.weight)}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {picking && <SwapPicker exercise={exercise} onPick={(p) => void swapTo(p)} onClose={() => setPicking(false)} />}

      {failed ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Couldn&rsquo;t load this movement. Try again.</p>
      ) : !log ? (
        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">Loading&hellip;</p>
      ) : (
        <>
          <div className="rounded-2xl border border-hairline bg-surface px-3 pb-3 sm:px-4">
            <div
              className={`grid ${cols} items-center gap-2 border-b border-hairline py-2 text-xs font-semibold text-muted`}
            >
              <span>Set</span>
              <span className="hidden sm:block">Last time</span>
              {metric === "WEIGHT" && <span>Weight ({unit})</span>}
              <span>{metric === "DURATION" ? "Seconds" : "Reps"}</span>
              <span className="text-center">Done</span>
              <span />
            </div>
            {rows.map((r, i) => {
              const hw = hintW(r);
              // Warm-up, main and supplemental sets each under their own
              // heading, numbered from 1 (v0.623).
              const grp = groupOf(r);
              const startsGroup = grouped && (i === 0 || groupOf(rows[i - 1]) !== grp);
              const n = i + 1 - rows.slice(0, i).filter((x) => groupOf(x) !== grp).length;
              return (
                <div key={r.key}>
                  {startsGroup && (
                    <p
                      className={`pb-1 text-xs font-semibold uppercase tracking-widest text-muted ${i > 0 ? "pt-4" : "pt-1"}`}
                    >
                      {grp === "warm" ? "Warm-up" : grp === "supp" ? suppLabel : "Main sets"}
                    </p>
                  )}
                  <div className={`border-b border-hairline py-2 ${r.saved ? "bg-accent/[0.03]" : ""}`}>
                    <div className={`grid ${cols} items-center gap-2`}>
                      <span className="tabular pl-1 text-sm font-semibold">
                        {grouped ? n : i + 1}
                        {r.pct != null && (
                          <span className="block text-[11px] font-semibold leading-none text-accent">
                            {Math.round(r.pct * 100)}%
                          </span>
                        )}
                      </span>
                      <span className="tabular hidden text-sm text-muted sm:block">
                        {r.added ? "new" : lastText(lastSets[i], metric)}
                      </span>
                      {metric === "WEIGHT" && (
                        <input
                          aria-label={`Weight, set ${i + 1}`}
                          inputMode="decimal"
                          value={r.w}
                          placeholder={hw != null ? fmtNumber(hw) : ""}
                          onChange={(e) =>
                            update(r.key, { w: e.target.value, saved: r.saved && e.target.value === r.w })
                          }
                          className={`tabular h-11 w-full rounded-lg border bg-surface px-3 text-base outline-none placeholder:text-muted/80 focus:border-accent ${r.w ? "border-accent/60" : "border-hairline"}`}
                        />
                      )}
                      {metric === "DURATION" ? (
                        <input
                          aria-label={`Seconds, set ${i + 1}`}
                          inputMode="numeric"
                          value={r.s}
                          placeholder={r.hintS != null ? String(r.hintS) : ""}
                          onChange={(e) => update(r.key, { s: e.target.value, saved: false })}
                          className={`tabular h-11 w-full rounded-lg border bg-surface px-3 text-base outline-none placeholder:text-muted/80 focus:border-accent ${r.s ? "border-accent/60" : "border-hairline"}`}
                        />
                      ) : (
                        <input
                          aria-label={`Reps, set ${i + 1}`}
                          inputMode="numeric"
                          value={r.r}
                          placeholder={r.hintR != null ? `${r.hintR}${r.plus ? "+" : ""}` : ""}
                          onChange={(e) => update(r.key, { r: e.target.value, saved: false })}
                          className={`tabular h-11 w-full rounded-lg border bg-surface px-3 text-base outline-none placeholder:text-muted/80 focus:border-accent ${r.r ? "border-accent/60" : "border-hairline"}`}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => tick(r)}
                        aria-label={r.saved ? `Undo set ${i + 1}` : `Done: set ${i + 1}`}
                        aria-pressed={r.saved}
                        className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                          r.saved
                            ? "border-accent bg-accent text-on-accent"
                            : "border-accent/40 text-accent hover:border-accent"
                        }`}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      {strict ? (
                        // A set the program fixed isn't removed: a set left blank
                        // simply isn't logged. Its plates instead (v0.619).
                        <button
                          type="button"
                          onClick={() => setCalcKey(r.key)}
                          aria-label={`Plates for set ${i + 1}`}
                          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
                        >
                          <DumbbellIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => (r.saved ? setConfirmKey(r.key) : remove(r))}
                          aria-label={`Remove set ${i + 1}`}
                          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {(() => {
                      if (metric !== "WEIGHT" || (!r.saved && !typed(r))) return null;
                      const pct = bigJump(valueOf(r).weight, log?.recentTop ?? null);
                      return pct != null ? (
                        <p className="mt-1 pl-10 text-xs font-semibold text-amber-700">
                          {pct}% over your recent top. Make sure it&rsquo;s the weight you meant.
                        </p>
                      ) : null;
                    })()}
                    {r.saved && metric === "WEIGHT" && isNewBest(valueOf(r), records) && (
                      <p className="mt-1 pl-10 text-xs font-semibold text-emerald-700">
                        New best for {valueOf(r).reps} {valueOf(r).reps === 1 ? "rep" : "reps"}
                      </p>
                    )}
                    {confirmKey === r.key && (
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm">
                        <span className="mr-auto">
                          Remove set {i + 1} ({lastText(valueOf(r) as MovementSetRow, metric)})?
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(r)}
                          className="inline-flex h-9 items-center rounded-full bg-red-700 px-4 text-xs font-semibold text-white"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmKey(null)}
                          className="inline-flex h-9 items-center rounded-full border border-hairline bg-surface px-4 text-xs font-semibold"
                        >
                          Keep
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center gap-2 pt-3">
              <button
                type="button"
                onClick={addSet}
                className={SECONDARY_LG}
              >
                <PlusIcon className="h-4 w-4" />
                Add set
              </button>
              {!anyEntered && hasHints && (
                <button
                  type="button"
                  onClick={sameAsLast}
                  className="inline-flex h-11 items-center rounded-full border border-accent/30 bg-accent/5 px-4 text-sm font-semibold text-accent hover:bg-accent/10"
                >
                  Same as last time
                </button>
              )}
              {metric === "WEIGHT" && hasHints && !strict && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted">
                  Remaining sets
                  <button
                    type="button"
                    onClick={() => setShift((s) => s - step)}
                    aria-label={`Lower the remaining sets by ${step} ${unit}`}
                    className="tabular h-10 w-11 rounded-full border border-hairline text-sm font-bold text-ink hover:border-accent"
                  >
                    −{fmtNumber(step)}
                  </button>
                  <span className="tabular min-w-[3.25rem] text-center text-xs font-semibold text-accent">
                    {shift === 0 ? "" : `${shift > 0 ? "+" : "−"}${fmtNumber(Math.abs(shift))} ${unit}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShift((s) => s + step)}
                    aria-label={`Raise the remaining sets by ${step} ${unit}`}
                    className="tabular h-10 w-11 rounded-full border border-hairline text-sm font-bold text-ink hover:border-accent"
                  >
                    +{fmtNumber(step)}
                  </button>
                </span>
              )}
            </div>
          </div>

          {rows.some((r) => r.saved) && !skipped && (
            <section className="rounded-2xl border border-hairline bg-surface px-4 py-3">
              <EffortPicker
                question={`How did ${(doing?.name ?? exercise.name).toLowerCase()} feel?`}
                effort={effort}
                hurt={hurt}
                onChange={(e, h) => saveFeedback(e, h)}
              />
            </section>
          )}

          <div className="grid grid-cols-3 gap-2">
            <PlanActionTile
              icon={MoonIcon}
              label={skipped ? "Skipped" : "Skip"}
              dim={skipped}
              pressed={skipped}
              onClick={() => void toggleSkip()}
            />
            <PlanActionTile
              icon={metric === "DURATION" ? TimerIcon : DumbbellIcon}
              label={metric === "DURATION" ? "Timer" : "Calculator"}
              onClick={() =>
                metric === "DURATION"
                  ? setTimerKey(nextUnsaved?.key ?? rows.at(-1)?.key ?? null)
                  : setCalcKey(nextUnsaved?.key ?? null)
              }
              disabled={metric !== "WEIGHT" && metric !== "DURATION"}
            />
            <PlanActionTile
              icon={CheckIcon}
              label={leaving ? "Saving" : "Log"}
              filled
              loading={leaving}
              disabled={leaving || !canLog}
              onClick={() => {
                const left = rows.filter((r) => !r.saved && !(typed(r) && complete(r))).length;
                if (left > 0) setConfirmLeave(true);
                else void leave();
              }}
            />
          </div>
          {confirmLeave && (
            <Modal title="Finish early?" onClose={() => setConfirmLeave(false)}>
              <p className="text-sm">
                {(() => {
                  const left = rows.filter((r) => !r.saved && !(typed(r) && complete(r))).length;
                  return `${left} ${left === 1 ? "set isn't" : "sets aren't"} logged yet. They'll still be here when you come back.`;
                })()}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button type="button" onClick={() => setConfirmLeave(false)} className={PRIMARY_BTN}>
                  Keep going
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmLeave(false);
                    void leave();
                  }}
                  className={SECONDARY_BTN}
                >
                  Finish for now
                </button>
              </div>
            </Modal>
          )}
        </>
      )}

      {timerKey != null && (
        <ConditioningTimer
          userId={userId}
          workout={{
            name: doing?.name ?? exercise.name,
            type: "FOR_TIME",
            capSec: null,
            movements: [],
            resultLabel: "Time",
            today: null,
          }}
          lastText={null}
          logLabel={`Use for set ${rows.findIndex((r) => r.key === timerKey) + 1}`}
          onLog={async (seconds) => {
            update(timerKey, { s: String(Math.round(seconds)), saved: false });
            setTimerKey(null);
          }}
          onClose={() => setTimerKey(null)}
        />
      )}

      {calcKey != null && (
        <WeightCalculator
          onClose={() => setCalcKey(null)}
          startTotal={calcRow && unit === "lb" ? (valueOf(calcRow).weight ?? undefined) : undefined}
          useLabel={calcRow ? `Use for set ${rows.indexOf(calcRow) + 1}` : undefined}
          onUse={
            calcRow && unit === "lb"
              ? (total) => {
                  update(calcRow.key, { w: fmtNumber(total), saved: false });
                  setCalcKey(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/**
 * One suggestion: what and why, with its choices. Never applied on its own;
 * answering hides it for the day.
 */
function SuggestionCard({ s, onAnswer }: { s: Suggestion; onAnswer: (answer: string) => void }) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3">
      <span className="min-w-[14rem] flex-1">
        <span className="block text-sm font-semibold">{s.title}</span>
        <span className="block text-xs text-muted">{s.why}</span>
      </span>
      <span className="flex flex-wrap gap-2">
        {s.actions.map((a, i) => (
          <button
            key={a.answer}
            type="button"
            onClick={() => onAnswer(a.answer)}
            className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${
              i === 0 ? "border-accent bg-accent text-on-accent" : "border-hairline bg-surface hover:border-accent"
            }`}
          >
            {a.label}
          </button>
        ))}
      </span>
    </section>
  );
}
