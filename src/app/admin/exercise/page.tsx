import { AdminBack } from "@/components/admin-back";
import { loadWorkoutAdmin, loadExercisePool } from "@/lib/queries/workouts";
import { WorkoutAdmin } from "./workout-admin";
import { ExercisePool } from "./exercise-pool";

export const dynamic = "force-dynamic";

export default async function AdminWorkoutsPage() {
  const [{ unitSystem, people }, pool] = await Promise.all([
    loadWorkoutAdmin(),
    loadExercisePool(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Workouts
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Build the shared exercise pool people choose from, set the measurement
          system, and open a person to manage their records.
        </p>
      </header>

      <div className="space-y-10">
        <ExercisePool pool={pool} />
        <WorkoutAdmin unitSystem={unitSystem} people={people} />
      </div>
    </main>
  );
}
