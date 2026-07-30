import { AdminBack } from "@/components/admin-back";
import {
  loadWorkoutAdmin,
  loadExercisePool,
  loadWeightUnits,
  loadHiitWorkouts,
  loadPendingHiitShares,
} from "@/lib/queries/workouts";
import { WorkoutAdmin } from "./workout-admin";
import { ExercisePool } from "./exercise-pool";
import { HiitWorkouts } from "./hiit-workouts";
import { PendingShares } from "./pending-shares";

export const dynamic = "force-dynamic";

export default async function AdminWorkoutsPage() {
  const [{ people }, pool, weightUnits, hiitWorkouts, pendingShares] =
    await Promise.all([
      loadWorkoutAdmin(),
      loadExercisePool(),
      loadWeightUnits(),
      loadHiitWorkouts(),
      loadPendingHiitShares(),
    ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Workouts
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Build the shared exercise pool people choose from, set the weight unit
          per muscle group, and open a person to manage their logged workouts.
        </p>
      </header>

      <div className="space-y-10">
        <ExercisePool pool={pool} weightUnits={weightUnits} />
        {pendingShares.length > 0 && <PendingShares shares={pendingShares} />}
        <HiitWorkouts
          movements={pool.filter((p) => p.category === "HIIT")}
          workouts={hiitWorkouts}
        />
        <WorkoutAdmin people={people} />
      </div>
    </main>
  );
}
