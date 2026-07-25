import { AdminBack } from "@/components/admin-back";
import { loadWorkoutAdmin } from "@/lib/queries/workouts";
import { WorkoutAdmin } from "./workout-admin";

export const dynamic = "force-dynamic";

export default async function AdminWorkoutsPage() {
  const { unitSystem, people } = await loadWorkoutAdmin();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Workouts
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          People build and log their own workouts on the Workouts page. Here you
          set the measurement system and can see who&rsquo;s tracking what.
        </p>
      </header>

      <WorkoutAdmin unitSystem={unitSystem} people={people} />
    </main>
  );
}
