"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DateField } from "@/components/date-field";
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
  RefreshIcon,
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
  loadLoggedWeights,
  overdueWorkoutDates,
  type LoggedSet,
} from "@/lib/actions/workouts";
import { addDays, dayOfWeek, formatShort } from "@/lib/dates";
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
import BodyMap from "@/components/body-map";
import {
  groupsFor,
  navRegionFor,
  type NavRegion,
} from "@/lib/workouts/involvement";

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

  // The overlay is one scrolling container and the steps swap inside it, so
  // scrolling down the menu to reach "Recent workouts" and then opening it
  // left the new screen scrolled to the same offset — which reads as the list
  // opening at its bottom. Every step starts at the top.
  const paneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 });
  }, [step]);
  const [calcOpen, setCalcOpen] = useState(false);
  // When creating a plan from scratch, which kind the person chose (before one
  // exists). Once a plan or rotation exists, that decides what's shown instead.
  const [planMode, setPlanMode] = useState<"weekly" | "rotation" | null>(null);
  // Which day the log step writes to. Defaults to today; can be set back to a
  // recent past day to record a workout that wasn't logged at the time.
  const [logDate, setLogDate] = useState(todayISO);
  // TODAY's logged sets, kept apart from `loggedByPool`. That one follows the
  // date picker on the "plan for this day" step, and the main Log workout step
  // is always about today — handing it the picker's data would prefill the
  // wrong day the moment someone looked at another one.
  const [loggedToday, setLoggedToday] = useState<Record<string, LoggedSet>>({});
  const [loadingToday, setLoadingToday] = useState(false);
  // Weights already logged for the picked earlier day (pool-exercise id -> value),
  // so the plan pre-fills them like the phone does.
  const [loggedByPool, setLoggedByPool] = useState<Record<string, LoggedSet>>({});
  const [loadingLogged, setLoadingLogged] = useState(false);
  const [overdueDates, setOverdueDates] = useState<string[]>([]);
  // Bumped after skipping a missed day so the Overdue list re-reads itself.
  const [overdueTick, setOverdueTick] = useState(0);
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
  const openUserId = open?.user.id ?? null;
  useEffect(() => {
    if (!openUserId) {
      setOverdueDates([]);
      return;
    }
    let cancelled = false;
    overdueWorkoutDates(openUserId)
      .then((d) => {
        if (!cancelled) setOverdueDates(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [openUserId, overdueTick]);
  useEffect(() => {
    let cancelled = false;
    if (openUserId) {
      setLoadingLogged(true);
      loadLoggedWeights(openUserId, logDate)
        .then((m) => {
          if (!cancelled) setLoggedByPool(m);
        })
        .catch(() => {
          if (!cancelled) setLoggedByPool({});
        })
        .finally(() => {
          if (!cancelled) setLoadingLogged(false);
        });
    } else {
      setLoggedByPool({});
      setLoadingLogged(false);
    }
    return () => {
      cancelled = true;
    };
  }, [openUserId, logDate, todayISO]);
  useEffect(() => {
    let cancelled = false;
    if (!openUserId) {
      setLoggedToday({});
      return;
    }
    setLoadingToday(true);
    loadLoggedWeights(openUserId, todayISO)
      .then((m) => {
        if (!cancelled) setLoggedToday(m);
      })
      .catch(() => {
        if (!cancelled) setLoggedToday({});
      })
      .finally(() => {
        if (!cancelled) setLoadingToday(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openUserId, todayISO, overdueTick]);
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
          ref={paneRef}
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
                      // The body map below highlights today's muscle groups,
                      // so naming them here said the same word three times.
                      null
                    ) : hasPlan ? (
                      <p className="mt-1 text-lg font-semibold">Rest day</p>
                    ) : (
                      <p className="mt-1 text-sm text-muted">No plan yet.</p>
                    )}
                  </div>

                  {!personal && open.weightSeries.length > 0 && (
                    <div>
                      <LiftBlocks
                        series={open.trackedSeries}
                        todayGroups={
                          open.planDays.find((d) => d.day === todayDow)
                            ?.groups ?? []
                        }
                      />
                      <LiftDetailPanel
                        all={open.trackedSeries}
                        planDays={open.planDays}
                      />
                    </div>
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
                    // Weekly and rotation can both be active at once; this picks
                    // which one to view/edit.
                    const view: "weekly" | "rotation" =
                      planMode ?? (hasRotation && !hasWeekly ? "rotation" : "weekly");
                    const tab = (mode: "weekly" | "rotation", label: string) => (
                      <button
                        type="button"
                        onClick={() => setPlanMode(mode)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                          view === mode
                            ? "border-accent text-accent"
                            : "border-hairline text-muted hover:border-accent"
                        }`}
                      >
                        {label}
                      </button>
                    );
                    return (
                      <>
                        <div className="mb-4 flex gap-2">
                          {tab("weekly", "Weekly plan")}
                          {tab("rotation", hasRotation ? "Rotation" : "Add a rotation")}
                        </div>
                        {view === "weekly" ? (
                          <PlanBuilder
                            userId={open.user.id}
                            plan={open.plan}
                            todayDow={todayDow}
                            pool={pool}
                            weeklyStart={open.weeklyStart}
                            weeklyActive={open.weeklyActive}
                            hiitWorkouts={hiitWorkouts.filter(
                              (w) =>
                                w.ownerId === null ||
                                w.ownerId === open.user.id,
                            )}
                          />
                        ) : (
                          <RotationBuilder
                            userId={open.user.id}
                            rotation={open.rotation}
                          />
                        )}
                      </>
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
                    <DateField
                      value={logDate}
                      max={todayISO}
                      min={addDays(todayISO, -90)}
                      onChange={(v) => {
                        const d = v || todayISO;
                        setLogDate(d);
                        if (d !== todayISO) setLoadingLogged(true);
                      }}
                      ariaLabel="Date"
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
                      {overdueDates.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-display text-sm font-semibold text-red-700">
                            Overdue
                          </h4>
                          {overdueDates.map((od) => {
                            const w = open.plan[dayOfWeek(od)]?.workouts ?? [];
                            if (w.length === 0) return null;
                            return (
                              <div
                                key={od}
                                className="rounded-xl border border-red-200 bg-red-50 p-3"
                              >
                                <TodayPlan
                                  userId={open.user.id}
                                  dateISO={od}
                                  workouts={w}
                                  doneLabels={[]}
                                  paused={null}
                                  rested={false}
                                  unitSystem={unitSystem}
                                  heading={`Missed ${formatShort(od)}`}
                                  // Counts for the day it was due; recorded as
                                  // done today. The card itself is unchanged.
                                  completedOnISO={todayISO}
                                />
                                {/* Log it, or be done with it. Without this the
                                    only way to clear a missed day was to switch
                                    the date picker to it — the Overdue list
                                    showed the problem and not the way out. */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    startTransition(async () => {
                                      await restDay(open.user.id, od);
                                      setOverdueTick((n) => n + 1);
                                    })
                                  }
                                  className="mt-2 inline-flex h-9 items-center rounded-full border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-100"
                                >
                                  Skip this day
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Gated the same way the home page gates its copy: the
                          prefill is read once when the rows mount, so mounting
                          before the fetch returns captures nothing. */}
                      {loadingToday ? (
                        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
                          Loading logged weights&hellip;
                        </p>
                      ) : (
                        <TodayPlan
                          userId={open.user.id}
                          dateISO={todayISO}
                          workouts={open.plan[todayDow]?.workouts ?? []}
                          doneLabels={open.todayWorkouts.map((w) => w.label)}
                          paused={open.today.paused}
                          rested={open.today.rested}
                          unitSystem={unitSystem}
                          loggedByPool={loggedToday}
                        />
                      )}

                      <div className="border-t border-hairline pt-5">
                        <h4 className="mb-3 font-display text-sm font-semibold">
                          Log an additional workout
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
                      {loadingLogged ? (
                        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
                          Loading logged weights…
                        </p>
                      ) : (
                        <TodayPlan
                          key={logDate}
                          userId={open.user.id}
                          dateISO={logDate}
                          workouts={open.plan[dayOfWeek(logDate)]?.workouts ?? []}
                          doneLabels={[]}
                          paused={null}
                          rested={false}
                          unitSystem={unitSystem}
                          heading="Plan for this day"
                          loggedByPool={loggedByPool}
                        />
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(async () => {
                              await markWorkedOut(open.user.id, logDate, true);
                              setStep("menu");
                            })
                          }
                          className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent"
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
                          {/* Weekday over the date, both hard left. Matching
                              the app, which already said 10/7 while the web
                              said Oct 7 for the same workout. */}
                          <span className="w-14 shrink-0 text-xs leading-tight text-muted">
                            <span className="block font-medium">
                              {weekdayAbbr(h.dateISO)}
                            </span>
                            <span className="tabular block">
                              {fmtHistoryDate(h.dateISO)}
                            </span>
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

/**
 * The three numbers that tell a lifter where they are, all from real logged
 * sets: how much the best set moved in the last 30 days, how long since that
 * best was set (a stall is information), and the recent sessions in order.
 */


/**
 * The headline for a set of lifts: the record first, then whether it is still
 * moving. These are the numbers people check; the chart underneath is for the
 * long view. Nothing is compared across lifts, because a deadlift and an
 * overhead press share no scale, and every figure is a real logged set.
 */
/** Validated categorical steps; identity, never a ramp. */
/**
 * One fixed colour per muscle group, so the body map and the heading above its
 * charts always agree. GRID_COLORS is positional — a group's colour there
 * depends on which other groups happen to be present — which is fine for an
 * ad-hoc legend and useless for "the pink on the body means Core".
 *
 * The hues echo the source artwork's own key, so the map reads like the
 * reference illustration rather than like a recolour of it.
 */
const MG_COLOR: Record<string, string> = {
  CHEST: "#e34948",
  BACK: "#1baf7a",
  LEGS: "#2a78d6",
  SHOULDERS: "#eb6834",
  ARMS: "#8a5cd6",
  CORE: "#eda100",
  GLUTES: "#d6568f",
  CALVES: "#2f9bb5",
  FOREARMS: "#7a6ad8",
  UPPER_BACK: "#139c86",
  FULL_BODY: "#e87ba4",
};

/** The same colour, faded, for a muscle a movement only assists with. */
function faded(hex: string): string {
  return `color-mix(in srgb, ${hex} 32%, var(--color-surface))`;
}

const GRID_COLORS = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100",
  "#e87ba4", "#008300", "#4a3aa7", "#e34948",
];

const MG_LABEL: Record<string, string> = {
  CHEST: "Chest", BACK: "Back", LEGS: "Legs", SHOULDERS: "Shoulders",
  ARMS: "Arms", CORE: "Core", GLUTES: "Glutes", CALVES: "Calves",
  FOREARMS: "Forearms", UPPER_BACK: "Upper back", FULL_BODY: "Full body",
};

/** Series grouped by the muscle group they are planned under, alphabetically. */
/**
 * One block per muscle group — plus one block per movement that has no group.
 *
 * A deadlift is not a back lift or a leg lift, and filing it as either puts a
 * 300 lb hinge in the same chart as a lat pulldown or a leg extension. A
 * movement with no group is therefore its own block, titled with its own name,
 * and it sorts alphabetically among the groups rather than being swept into an
 * "Other" bucket: it is a peer, not a leftover.
 */
function byMuscleGroup(series: LiftSeries[]): { key: string; label: string; items: LiftSeries[] }[] {
  const map = new Map<string, { label: string; items: LiftSeries[] }>();
  for (const s of series) {
    // No group: keyed by the movement, so each gets a block of its own.
    const grouped = s.muscleGroup != null;
    const key = grouped ? s.muscleGroup! : `__mv:${s.exerciseId}`;
    const label = grouped ? (MG_LABEL[s.muscleGroup!] ?? s.muscleGroup!) : s.name;
    const cur = map.get(key);
    map.set(key, { label, items: [...(cur?.items ?? []), s] });
  }
  return [...map.entries()]
    .map(([key, { label, items }]) => ({
      key,
      label,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * One progress block per muscle group: its headline numbers and its own plot,
 * stacked. A day with Core and Legs reads as two blocks you scroll, which is
 * why there is no movement picker any more — a picker hid everything but one.
 */
function LiftBlocks({
  series,
  todayGroups = [],
}: {
  series: LiftSeries[];
  /** Muscle groups today's plan asks for. The map opens on these. */
  todayGroups?: string[];
}) {
  const withBest = useMemo(() => series.filter((s) => s.best), [series]);

  // Which region selects each movement, and which groups it lights up. These
  // are different questions: a deadlift is selected from the lower back and
  // glutes, and lights Legs, Back and Core.
  const meta = useMemo(
    () =>
      withBest.map((s) => ({
        s,
        nav: navRegionFor(s.name, s.muscleGroup ?? null),
        ...groupsFor(s.name, s.muscleGroup ?? null),
      })),
    [withBest],
  );

  // Only regions you actually train are live. A Chest you have never pressed
  // is drawn, but inert — a target that selects nothing is a dead end.
  const available = useMemo(
    () => [...new Set(meta.map((m) => m.nav).filter(Boolean))] as NavRegion[],
    [meta],
  );

  // What the map opens on: everything today asks for. A day that trains Core
  // and Legs lights both, because that is what the day is.
  const todayNavs = useMemo(() => {
    const want = new Set(todayGroups);
    const navs = meta
      .filter((m) => m.primary && want.has(m.primary))
      .map((m) => m.nav)
      .filter(Boolean) as NavRegion[];
    return [...new Set(navs)];
  }, [meta, todayGroups]);

  // Nothing planned today — fall back to whatever was trained most recently,
  // which is what someone on a rotation or no plan at all still has.
  const latestNav = useMemo(() => {
    let best: { nav: NavRegion; date: string } | null = null;
    for (const m of meta) {
      if (!m.nav) continue;
      const last = m.s.points.at(-1)?.date;
      if (!last) continue;
      if (!best || last > best.date) best = { nav: m.nav, date: last };
    }
    return best?.nav ?? available[0] ?? null;
  }, [meta, available]);

  // null means "today". Picking a region narrows to it; the button comes back.
  const [picked, setPicked] = useState<NavRegion | null>(null);
  const openOn = todayNavs.length > 0 ? todayNavs : latestNav ? [latestNav] : [];
  const active = picked ? [picked] : openOn;
  const activeSet = useMemo(() => new Set(active), [active]);

  const shown = meta.filter((m) => m.nav && activeSet.has(m.nav));
  // Nothing on the body selects an ungrouped movement or a full-body lift, so
  // those keep their own blocks below rather than becoming unreachable.
  const orphans = meta.filter((m) => !m.nav);

  // Primary wins over secondary: a muscle a movement trains should not be
  // dimmed because some other shown movement merely assists with it.
  // Per figure, because both are always drawn now. A movement's `view` decides
  // which figure it paints: a deadlift lights the back and leaves the front
  // grey, a squat lights both. That is what separates them on the body without
  // ever taking a figure away from the reader.
  const [fillsFront, fillsBack] = useMemo(() => {
    const front: Record<string, string> = {};
    const back: Record<string, string> = {};
    const targets = (v: string) =>
      v === "front" ? [front] : v === "back" ? [back] : [front, back];
    for (const m of shown) {
      for (const t of targets(m.view)) {
        for (const g of m.secondary) {
          if (!t[g] && MG_COLOR[g]) t[g] = faded(MG_COLOR[g]);
        }
      }
    }
    for (const m of shown) {
      for (const t of targets(m.view)) {
        if (m.primary && MG_COLOR[m.primary]) t[m.primary] = MG_COLOR[m.primary];
      }
    }
    return [front, back];
  }, [shown]);

  const groups = byMuscleGroup(shown.map((m) => m.s));
  const orphanGroups = byMuscleGroup(orphans.map((m) => m.s));

  if (meta.length === 0) return null;

  return (
    <div className="space-y-4">
      {available.length > 0 && (
        <div className="relative">
          {picked && (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:border-accent hover:text-accent"
              aria-label="Back to today's workout"
              title="Back to today's workout"
            >
              <RefreshIcon className="h-4 w-4" />
            </button>
          )}
          <BodyMap
            selected={active}
            onSelect={setPicked}
            available={available}
            fillsFront={fillsFront}
            fillsBack={fillsBack}
          />
        </div>
      )}
      {[...groups, ...orphanGroups].map((g) => (
        <div key={g.key}>
          <p
            className="text-sm font-semibold"
            style={{ color: MG_COLOR[g.key] ?? "var(--color-accent)" }}
          >
            {g.label}
          </p>
          <LiftHeadline series={g.items} />
          <GroupCharts series={g.items} groupKey={g.key} />
        </div>
      ))}
    </div>
  );
}

function LiftHeadline({ series }: { series: LiftSeries[] }) {
  const lifts = series.filter((s) => s.best);
  if (lifts.length === 0) return null;
  // Numbers first, no chart. Six equal tiles in a fixed grid: they used to be
  // fixed-width in a wrapping row, which left them bunched to the left with
  // ragged gaps.
  return (
    <div className="mt-3 space-y-2">
      {lifts.map((s) => {
        const stats = liftStats(s);
        const sorted = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        return (
          <div
            key={s.exerciseId}
            className="rounded-xl border border-hairline bg-ground/40 px-3 py-2.5"
          >
            <p className="mb-2 text-sm font-semibold">{s.name}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatTile
                k="record"
                v={`${s.best!.value}`}
                unit={s.unit}
                sub={formatShort(s.best!.date)}
              />
              {/* Reps at the record, falling back to the best rep count
                  logged at any weight. The record predates reps being stored,
                  so this tile read "none logged yet" while LAST, two tiles
                  over, showed the same movement at x2. */}
              {(() => {
                const topRep = (s.repMaxes ?? []).reduce<
                  { reps: number; value: number } | null
                >((a, b) => (a && a.reps >= b.reps ? a : b), null);
                const atRecord = s.best!.reps;
                const shown = atRecord ?? topRep?.reps ?? null;
                return (
                  <StatTile
                    k="reps"
                    v={shown ? `${shown}` : "\u2014"}
                    unit={shown ? "reps" : ""}
                    sub={
                      atRecord
                        ? "at the record"
                        : topRep
                          ? `best, at ${topRep.value} ${s.unit}`
                          : "none logged yet"
                    }
                  />
                );
              })()}
              <StatTile
                k="30 days"
                v={stats.delta === null ? "\u2014" : `${stats.delta > 0 ? "+" : ""}${stats.delta}`}
                unit={stats.delta === null ? "" : s.unit}
                sub={
                  stats.delta === null
                    ? "no older session"
                    : stats.delta > 0
                      ? "still climbing"
                      : "flat"
                }
                tone={stats.delta !== null && stats.delta > 0 ? "up" : undefined}
              />
              <StatTile
                k="since best"
                v={stats.sincePR.replace(/^best /, "").replace(/ ago$/, "")}
                unit=""
                sub="last record"
              />
              <StatTile
                k="sessions"
                v={`${stats.sessions}`}
                unit=""
                sub={first ? `since ${formatShort(first.date)}` : ""}
              />
              <StatTile
                k="last"
                v={last ? `${last.value}` : "\u2014"}
                unit={last ? `${s.unit}${last.reps ? ` \u00d7 ${last.reps}` : ""}` : ""}
                sub={last ? formatShort(last.date) : ""}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * One disclosure per MUSCLE GROUP, at the foot of its movements.
 *
 * Arms with a close-grip bench and an EZ bar curl was two "Additional charts"
 * links and two near-identical plots; the group is the thing being looked at,
 * so its movements share one chart with a line each.
 */
function GroupCharts({
  series,
  groupKey,
}: {
  series: LiftSeries[];
  groupKey: string;
}) {
  const [open, setOpen] = useState(false);
  const withReps = series.filter((s) => (s.repMaxes?.length ?? 0) > 0);
  const tone = MG_COLOR[groupKey] ?? series[0]?.color ?? "var(--color-accent)";
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold text-accent"
      >
        {open ? "Hide charts" : "Additional charts"}
      </button>
      {open && (
        <div className="mt-2">
          {/* One plot for the group, a line per movement. Separate charts per
              exercise drew the same axis twice to say less. */}
          <LineChart
            weight
            dots
            series={series.map((s) => ({
              id: s.exerciseId,
              name: s.name,
              color: s.color,
              unit: s.unit,
              points: s.points,
            }))}
          />
          {withReps.map((s) => {
            const reps = s.repMaxes ?? [];
            const max = Math.max(...reps.map((x) => x.value), 1);
            return (
              <div key={s.exerciseId} className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                  Best reps per weight
                </p>
                <p className="text-sm">{s.name}</p>
                {[...reps]
                  .sort((a, b) => a.reps - b.reps)
                  .map((r) => (
                    <div key={r.reps} className="mt-1 flex items-center gap-2">
                      <span className="w-14 shrink-0 text-xs text-muted">
                        {r.reps} rep{r.reps === 1 ? "" : "s"}
                      </span>
                      <span className="h-2 min-w-0 flex-1 rounded-full bg-surface">
                        <span
                          className="block h-2 rounded-full"
                          style={{
                            width: `${(r.value / max) * 100}%`,
                            background: tone,
                          }}
                        />
                      </span>
                      <span className="tabular w-20 shrink-0 text-right text-xs font-semibold">
                        {r.value} {s.unit}
                      </span>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatTile({
  k,
  v,
  unit,
  sub,
  tone,
}: {
  k: string;
  v: string;
  unit: string;
  sub: string;
  tone?: "up";
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {k}
      </p>
      <p
        className={`tabular font-display text-xl font-semibold leading-tight ${
          tone === "up" ? "text-emerald-600" : ""
        }`}
      >
        {v}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span>}
      </p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

const DOW_ABBR = ["S", "M", "T", "W", "T", "F", "S"];

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type LiftSeries = PersonWorkout["weightSeries"][number];

/**
 * The three views behind the headline numbers, each on its own card:
 * what you can lift for a given rep count, which lifts are still moving, and
 * whether you have been turning up. Everything is derived from logged sets —
 * there are no estimated maxes anywhere, and no two lifts share a weight axis.
 */
function LiftDetailPanel({
  all,
  planDays,
  chart,
}: {
  all: LiftSeries[];
  /** Weekdays the plan uses, so the grid only draws rows that mean something. */
  planDays?: { day: number; groups: string[] }[];
  /** The session plot, shown last. The numbers lead; the chart is the long
   *  view and does not need to be the first thing on the page. */
  chart?: React.ReactNode;
}) {

  // Change over 90 days per lift. Percent is the only honest way to put a
  // deadlift and an overhead press on one axis; the real weights stay in the
  // label so a 5lb gain on a light lift cannot masquerade as a big one.
  const movement = all
    .map((s) => {
      const cutoff = new Date(Date.now() - 90 * 86400000)
        .toISOString()
        .slice(0, 10);
      const window = s.points.filter((p) => p.date >= cutoff);
      if (window.length < 2) return null;
      const from = window[0].value;
      const to = window.reduce((m, p) => Math.max(m, p.value), 0);
      if (!from || to <= 0) return null;
      return {
        id: s.exerciseId,
        name: s.name,
        unit: s.unit,
        from,
        to,
        pct: Math.round(((to - from) / from) * 100),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.pct - a.pct);

  // Did you train? Built from the days that carry a logged set, so it says
  // "sessions logged" and not "sessions" — a rested day leaves no mark here.
  // Workout days: one square per day, coloured by MUSCLE GROUP rather than by
  // movement — the question is which day you trained, not which bar you held.
  // Matches byMuscleGroup: an ungrouped movement is its own series on the
  // attendance grid too, so it gets its own colour rather than sharing one.
  const groupOf = (s: LiftSeries) => s.muscleGroup ?? `__mv:${s.exerciseId}`;
  // One label resolver for the sort, the tooltips and the legend, so an
  // ungrouped movement reads as its own name everywhere instead of its key.
  const gLabels = new Map<string, string>();
  const groupsSeen: string[] = [];
  for (const s of all) {
    if (s.points.length === 0) continue;
    const g = groupOf(s);
    if (!gLabels.has(g)) gLabels.set(g, s.muscleGroup != null ? (MG_LABEL[g] ?? g) : s.name);
    if (!groupsSeen.includes(g)) groupsSeen.push(g);
  }
  const labelOf = (g: string) => gLabels.get(g) ?? MG_LABEL[g] ?? g;
  groupsSeen.sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
  // Muscle groups keep their fixed colour so the legend, the body map and the
  // heading above each chart all say the same thing. Only ungrouped movements,
  // which have no fixed colour of their own, fall back to the positional list.
  const groupColor = new Map<string, string>(
    groupsSeen.map((g, i) => [g, MG_COLOR[g] ?? GRID_COLORS[i % GRID_COLORS.length]]),
  );

  const byDate = new Map<string, string[]>();
  for (const s of all) {
    const g = groupOf(s);
    for (const p of s.points) {
      const list = byDate.get(p.date) ?? [];
      if (!list.includes(g)) list.push(g);
      byDate.set(p.date, list);
    }
  }
  const trained = byDate;

  // Only weekdays the plan uses get a row. A row for a day you never train is
  // noise, and the grid is about whether the plan was kept.
  const rows = planDays && planDays.length > 0
    ? [...planDays].map((d) => d.day).sort((a, b) => a - b)
    : [0, 1, 2, 3, 4, 5, 6];

  type Cell = { date: string; groups: string[] };
  const weeks: Cell[][] = [];
  {
    const end = new Date();
    end.setHours(12, 0, 0, 0);
    // Anchor to THIS week and count back, so the last column is the week in
    // progress. Going back 111 days and then snapping to Sunday moved the
    // window's start earlier without moving its end, so it finished at
    // today minus the weekday — on a Wednesday the current week was missing
    // and today never appeared at all.
    const start = new Date(end);
    start.setDate(start.getDate() - start.getDay() - 15 * 7);
    for (let w = 0; w < 16; w++) {
      const col: Cell[] = [];
      for (const dow of rows) {
        const day = new Date(start.getTime() + (w * 7 + dow) * 86400000);
        const iso = day.toISOString().slice(0, 10);
        col.push({ date: iso, groups: byDate.get(iso) ?? [] });
      }
      weeks.push(col);
    }
  }

  /** Up to two colours per square; three slices at this size is mud. */
  const cellStyle = (groups: string[]): React.CSSProperties => {
    if (groups.length === 0) return {};
    const cs = groups.map((g) => groupColor.get(g) ?? "var(--color-accent)");
    if (cs.length === 1) return { background: cs[0] };
    // Two reads best as a diagonal split. Three or more cannot extend that, so
    // they become equal vertical bands: one rule that degrades predictably,
    // where wedges or quarters at 18px turn to mud.
    if (cs.length === 2) {
      return {
        background: `linear-gradient(135deg, ${cs[0]} 0 50%, ${cs[1]} 50% 100%)`,
      };
    }
    // Three and four cut the square from its centre — thirds as wedges, four as
    // quadrants — which stays legible at this size because every piece meets in
    // the middle. Five or more would be slivers, so those become bands instead.
    if (cs.length === 3 || cs.length === 4) {
      const n = cs.length;
      // from 0deg points up, so four pieces land as true quadrants and three as
      // even wedges. Both meet in the middle, which is what keeps them readable
      // at 18px where slivers would not be.
      const wedges = cs
        .map((c, i) => `${c} ${(i / n) * 360}deg ${((i + 1) / n) * 360}deg`)
        .join(", ");
      return { background: `conic-gradient(from 0deg, ${wedges})` };
    }
    const n = cs.length;
    const stops = cs
      .map((c, i) => `${c} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`)
      .join(", ");
    return { background: `linear-gradient(90deg, ${stops})` };
  };

  if (movement.length === 0 && trained.size === 0) {
    return null;
  }

  return (
    // Always visible. These two describe the WHOLE plan, and hiding them behind
    // a phrase that got lost on the page is exactly what buried them. The only
    // disclosure left is per movement, under its own six tiles.
    <div className="mt-3">
      <div className="space-y-2">
          {movement.length > 0 && (
            <div className="rounded-xl border border-hairline bg-ground/40 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Lift progress
              </p>
              <p className="mt-0.5 text-xs text-muted">Change over 90 days</p>
              <div className="mt-2 space-y-1.5">
                {movement.map((m) => {
                  // A fixed 30% scale, widened only if something beat it. With a
                  // scale set by the best lift, a single movement always filled
                  // the whole track and looked like a bar chart of one thing.
                  const span = Math.max(
                    30,
                    ...movement.map((x) => Math.abs(x.pct)),
                  );
                  const stalled = m.pct < 10;
                  return (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 truncate text-xs">
                        {m.name}
                      </span>
                      <span className="h-2 min-w-0 flex-1 rounded-full bg-surface">
                        <span
                          className={`block h-2 rounded-full ${stalled ? "bg-amber-500" : "bg-accent"}`}
                          style={{
                            width: `${(Math.abs(m.pct) / span) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="tabular w-10 shrink-0 text-right text-xs font-medium">
                        {m.pct > 0 ? "+" : ""}
                        {m.pct}%
                      </span>
                      <span className="tabular hidden w-24 shrink-0 text-right text-xs text-muted sm:block">
                        {m.from}
                        {"\u2192"}
                        {m.to}
                        {m.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-hairline bg-ground/40 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Workout days
            </p>
            <div className="mt-2 flex gap-2 overflow-x-auto">
              <div className="flex shrink-0 flex-col gap-[4px] pt-[18px]">
                {rows.map((d) => (
                  <span key={d} className="h-5 text-[11px] leading-5 text-muted">
                    {DOW_ABBR[d]}
                  </span>
                ))}
              </div>
              <div>
                <div className="flex gap-[4px]">
                  {weeks.map((col, wi) => {
                    const m = col[0]?.date.slice(5, 7) ?? "";
                    const prev = wi > 0 ? weeks[wi - 1][0]?.date.slice(5, 7) : "";
                    return (
                      <span key={wi} className="w-5 text-[11px] leading-4 text-muted">
                        {m && m !== prev ? MONTH_ABBR[Number(m) - 1] : ""}
                      </span>
                    );
                  })}
                </div>
                <div className="flex gap-[4px]">
                  {weeks.map((col, wi) => (
                    <div key={wi} className="flex flex-col gap-[4px]">
                      {col.map((cell) => (
                        <span
                          key={cell.date}
                          title={
                            cell.groups.length
                              ? `${cell.date} \u2014 ${cell.groups.map((g) => labelOf(g)).join(", ")}`
                              : cell.date
                          }
                          style={cellStyle(cell.groups)}
                          className={`h-5 w-5 rounded-[4px] ${cell.groups.length === 0 ? "bg-surface" : ""}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
              {groupsSeen.map((g) => (
                <span key={g} className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded-[3px]"
                    style={{ background: groupColor.get(g) }}
                  />
                  {labelOf(g)}
                </span>
              ))}
            </div>
          </div>

          {chart && (
            <div className="rounded-xl border border-hairline bg-ground/40 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Every session
              </p>
              <p className="mt-0.5 text-xs text-muted">
                One point per logged set
              </p>
              <div className="mt-2">{chart}</div>
            </div>
          )}
      </div>
    </div>
  );
}

function liftStats(s: {
  points: { date: string; value: number; reps?: number | null }[];
  best?: { date: string; value: number; reps: number | null } | null;
}): {
  delta: number | null;
  sincePR: string;
  sessions: number;
  recent: { date: string; value: number; reps?: number | null }[];
} {
  const pts = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1));
  const recent = pts.slice(-5);

  // Change over 30 days: today's best set against the best on or before the
  // cutoff. Null when there is nothing that old to compare with, rather than
  // pretending the first ever session was a gain.
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const before = pts.filter((p) => p.date <= cutoff);
  const latest = pts[pts.length - 1]?.value ?? null;
  const base = before.length ? Math.max(...before.map((p) => p.value)) : null;
  const delta = latest != null && base != null ? Math.round(latest - base) : null;

  let sincePR = "no best yet";
  if (s.best) {
    const days = Math.max(
      0,
      Math.round((Date.now() - new Date(`${s.best.date}T12:00:00Z`).getTime()) / 86400000),
    );
    const weeks = Math.floor(days / 7);
    sincePR =
      days <= 1 ? "best today" : weeks < 1 ? `best ${days} days ago` : `best ${weeks}w ago`;
  }

  return { delta, sincePR, sessions: pts.length, recent };
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
          <LiftBlocks
            series={open.trackedSeries}
            todayGroups={
              open.planDays.find((d) => d.day === todayDow)?.groups ?? []
            }
          />
          <LiftDetailPanel
            all={open.trackedSeries}
            planDays={open.planDays}
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
/** "Mon". Parsed as a local date, not `new Date(iso)`, which reads a bare
 *  YYYY-MM-DD as UTC midnight and lands on the previous day west of Greenwich. */
function weekdayAbbr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
}

/** "10/5" — the same numeric form the app uses, so one workout reads the same
 *  way on both. Built from the parts rather than a locale format, because a
 *  locale that prints 5/10 would silently disagree with the phone. */
function fmtHistoryDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
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
  const [conflict, setConflict] = useState<{ name: string; summary: string } | null>(
    null,
  );
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

  const save = (replace = false) => {
    if (!canSave) return;
    startTransition(async () => {
      const res = await logCustomWorkout({
        userId,
        dateISO,
        poolExerciseId: isPoolCat ? poolId : null,
        category: isPoolCat ? null : category,
        metric,
        value,
        unit,
        load: cfg.load ? num(load) || null : null,
        notes: notes.trim() || undefined,
        replace,
      });
      if (res && "conflict" in res) {
        setConflict(res.conflict);
        return;
      }
      setConflict(null);
      onDone();
    });
  };

  const showRecordChoice = !!cfg.choices && !isSport && !isHiit;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div
          className={
            showRecordChoice || (!isHiit && isPoolCat) ? "" : "col-span-3"
          }
        >
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
          <div className="col-span-2">
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
        {!isHiit && isPoolCat && !showRecordChoice && (
          <div className="col-span-2">
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

      {conflict ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-ink">
            You already logged {conflict.name} today: {conflict.summary}.
          </p>
          <p className="mt-0.5 text-muted">Update it with the new value, or cancel?</p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => save(true)}
              disabled={pending}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-40"
            >
              {pending ? "Updating…" : "Update"}
            </button>
            <button
              type="button"
              onClick={() => setConflict(null)}
              className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => save()}
          disabled={!canSave}
          className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-on-accent disabled:opacity-40"
        >
          {pending ? "Logging…" : "Log workout"}
        </button>
      )}
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
        className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-on-accent disabled:opacity-40"
      >
        {pending ? "Logging…" : "Log workout"}
      </button>
    </div>
  );
}
