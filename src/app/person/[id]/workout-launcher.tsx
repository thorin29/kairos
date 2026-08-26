"use client";

import { useState } from "react";
import { CheckIcon, DumbbellIcon } from "@/components/icons";
import { formatShort } from "@/lib/dates";
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
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold">{title}</h3>
                  <p className="mt-0.5 text-sm text-muted">
                    Logging for {formatShort(dateISO)}
                  </p>
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
                <TodayPlan
                  userId={userId}
                  dateISO={dateISO}
                  workouts={workouts}
                  doneLabels={doneLabels}
                  paused={paused}
                  rested={rested}
                  unitSystem={unitSystem}
                  heading="Scheduled"
                />

                <div className="border-t border-hairline pt-5">
                  <h4 className="mb-3 font-display text-sm font-semibold">
                    Log a different workout
                  </h4>
                  <CustomWorkoutForm
                    userId={userId}
                    unitSystem={unitSystem}
                    pool={pool}
                    hiitWorkouts={hiitWorkouts}
                    dateISO={dateISO}
                    onDone={() => setOpen(false)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
