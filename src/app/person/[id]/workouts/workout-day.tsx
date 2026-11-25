"use client";

import { DayLog } from "@/app/exercise/day-log";
import { CustomWorkoutForm, HiitBuilder } from "@/app/exercise/workouts-grid";
import type { BoardHiitWorkout, PersonWorkout, PoolEntry } from "@/lib/queries/workouts";
import type { UnitSystem } from "@/lib/workouts/catalog";

/** The day's workouts as a page (v0.800; was the home card's pop-up): the
 *  same day page as Exercise → Log workout. */
export function WorkoutDay({
  person,
  pool,
  hiitWorkouts,
  unitSystem,
  todayISO,
}: {
  person: PersonWorkout;
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
  unitSystem: UnitSystem;
  todayISO: string;
}) {
  const userId = person.user.id;
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-6">
      <DayLog
        person={person}
        todayISO={todayISO}
        unitSystem={unitSystem}
        initialDate={todayISO}
        writeOwn={(d, done) => (
          <HiitBuilder
            pool={pool}
            workouts={hiitWorkouts.filter((w) => w.ownerId === null || w.ownerId === userId)}
            userId={userId}
            dateISO={d}
            onDone={done}
          />
        )}
        extra={(d, kind, done) => (
          <CustomWorkoutForm
            userId={userId}
            unitSystem={unitSystem}
            pool={pool}
            hiitWorkouts={hiitWorkouts}
            dateISO={d}
            initialCategory={kind === "sport" ? "SPORT" : "WEIGHTS"}
            onDone={done ?? (() => undefined)}
          />
        )}
      />
    </div>
  );
}
