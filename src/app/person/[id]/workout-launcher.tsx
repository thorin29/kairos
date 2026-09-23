"use client";

import { useEffect, useState } from "react";
import { CheckIcon, DumbbellIcon } from "@/components/icons";
import { formatShort, addDays, dayOfWeek } from "@/lib/dates";
import { DateField } from "@/components/date-field";
import { loadLoggedWeights, overdueWorkoutDates } from "@/lib/actions/workouts";
import { TodayPlan } from "@/app/exercise/workout-card";
import { CustomWorkoutForm } from "@/app/exercise/workouts-grid";
import type {
  PlanWorkout,
  PoolEntry,
  BoardHiitWorkout,
} from "@/lib/queries/workouts";
import type { UnitSystem } from "@/lib/workouts/catalog";

/**
 * A workout on someone's dashboard. Instead of a plain checkbox it opens the
 * same log step used on the Workouts board — scheduled plan workouts to
 * complete plus "log something else" — scoped to this prompt's own day, so a
 * workout carried over from an earlier day logs against that day, not today.
 */
export function WorkoutLauncher({
  userId,
  dateISO,
  title,
  done,
  overdue,
  workouts,
  doneLabels,
  rested,
  paused,
  pool,
  hiitWorkouts,
  unitSystem,
  weekPlan,
  todayISO,
  summaryNames,
  overdueCount = 0,
}: {
  userId: string;
  dateISO: string;
  title: string;
  done: boolean;
  overdue: boolean;
  workouts: PlanWorkout[];
  doneLabels: string[];
  rested: boolean;
  paused: string | null;
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
  unitSystem: UnitSystem;
  /** The person's weekly plan, indexed by ISO weekday, so a picked day shows
   *  that day's scheduled workout. */
  weekPlan: PlanWorkout[][];
  todayISO: string;
  /** When set, render ONE summary button for all of the day's workouts (their
   *  names, with an "N overdue" tag) instead of a per-workout row. */
  summaryNames?: string[];
  /** Server-computed count of overdue workouts, so the closed summary button can
   *  show it without waiting for the overlay's own fetch. */
  overdueCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [logDate, setLogDate] = useState(dateISO);
  const [loggedByPool, setLoggedByPool] = useState<Record<string, string>>({});
  const [loadingLogged, setLoadingLogged] = useState(false)
  const [overdueDates, setOverdueDates] = useState<string[]>([]);

  // Overdue workouts (past days still pending) to show at the top.
  useEffect(() => {
    if (!open) {
      setOverdueDates([]);
      return;
    }
    let cancelled = false;
    overdueWorkoutDates(userId)
      .then((d) => {
        if (!cancelled) setOverdueDates(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // Pull already-logged weights for a back-dated day so the plan pre-fills them.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (logDate !== todayISO) {
      setLoadingLogged(true);
      loadLoggedWeights(userId, logDate)
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
  }, [open, userId, logDate, todayISO]);

  const onOriginal = logDate === dateISO;
  const dayWorkouts = onOriginal ? workouts : weekPlan[dayOfWeek(logDate)] ?? [];

  return (
    <div className="px-4 py-3">
      {summaryNames ? (
        <button
          type="button"
          onClick={() => {
            setLogDate(dateISO);
            setOpen(true);
          }}
          className="flex w-full items-center gap-3 text-left"
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline text-muted"
            aria-hidden
          >
            <DumbbellIcon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center text-sm">
              {(overdueCount > 0
                ? summaryNames.slice(0, 2)
                : summaryNames.slice(0, 3)
              ).map((n, i) => (
                <span key={`${n}-${i}`} className="flex items-center">
                  {i > 0 && (
                    <span
                      className="mx-1.5 inline-block h-1 w-1 rounded-full bg-ink"
                      aria-hidden
                    />
                  )}
                  {n}
                </span>
              ))}
              {summaryNames.length === 0 && (
                <span className="text-muted">No workout today</span>
              )}
              {overdueCount > 0 && (
                <span className="ml-2 font-medium text-red-700">
                  {overdueCount} overdue
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-xs text-muted">Workouts</span>
          </span>
          <span className="shrink-0 rounded-full border border-hairline px-3 py-1 text-xs font-medium text-muted">
            Log
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setLogDate(dateISO);
            setOpen(true);
          }}
          className="flex w-full items-center gap-3 text-left"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              done
                ? "bg-accent text-white"
                : "border border-hairline text-muted"
            }`}
            aria-hidden
          >
            {done ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <DumbbellIcon className="h-3.5 w-3.5" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className={done ? "text-muted line-through" : undefined}>
              {title}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Workouts
              {overdue && (
                <span className="tabular ml-2 font-medium text-red-700">
                  due {formatShort(dateISO)}
                </span>
              )}
            </span>
          </span>

          <span className="shrink-0 rounded-full border border-hairline px-3 py-1 text-xs font-medium text-muted">
            {done ? "Edit" : "Log"}
          </span>
        </button>
      )}

      {open && (
        <div
          className="animate-backdrop-fade fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Log ${title}`}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-card-zoom my-4 w-full max-w-2xl"
          >
            <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-lg font-semibold">
                    Log workout
                  </h3>
                  <DateField
                    value={logDate}
                    max={todayISO}
                    min={addDays(todayISO, -90)}
                    onChange={(v) => {
                      const d = v || dateISO;
                      setLogDate(d);
                      if (d !== todayISO) setLoadingLogged(true);
                    }}
                    ariaLabel="Date"
                    className="tabular h-11 rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-ink"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-6">
                {logDate === todayISO && overdueDates.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-display text-sm font-semibold text-red-700">
                      {overdueDates.length === 1 ? "Overdue workout" : "Overdue workouts"}
                    </h4>
                    {overdueDates.map((od) => {
                      const w = weekPlan[dayOfWeek(od)] ?? [];
                      if (w.length === 0) return null;
                      return (
                        <div
                          key={od}
                          className="rounded-xl border border-red-200 bg-red-50 p-3"
                        >
                          <TodayPlan
                            userId={userId}
                            dateISO={od}
                            workouts={w}
                            doneLabels={[]}
                            paused={null}
                            rested={false}
                            unitSystem={unitSystem}
                            heading={`Missed ${formatShort(od)}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {logDate !== dateISO && (
                  <p className="text-xs text-muted">
                    Recording a workout for a different day.
                  </p>
                )}

                {loadingLogged ? (
                  <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">
                    Loading logged weights\u2026
                  </p>
                ) : (
                  <TodayPlan
                    key={logDate}
                    userId={userId}
                    dateISO={logDate}
                    workouts={dayWorkouts}
                    doneLabels={onOriginal ? doneLabels : []}
                    paused={onOriginal ? paused : null}
                    rested={onOriginal ? rested : false}
                    unitSystem={unitSystem}
                    heading="Scheduled"
                    loggedByPool={loggedByPool}
                  />
                )}

                <div className="border-t border-hairline pt-5">
                  <h4 className="mb-3 font-display text-sm font-semibold">
                    Log a different workout
                  </h4>
                  <CustomWorkoutForm
                    userId={userId}
                    unitSystem={unitSystem}
                    pool={pool}
                    hiitWorkouts={hiitWorkouts}
                    dateISO={logDate}
                    onDone={() => setOpen(false)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
