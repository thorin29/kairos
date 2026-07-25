import { AdminBack } from "@/components/admin-back";
import { loadExerciseAdmin } from "@/lib/queries/exercise";
import { ExerciseAdmin } from "./exercise-admin";

export const dynamic = "force-dynamic";

export default async function AdminExercisePage() {
  const { routines, roster, assignments } = await loadExerciseAdmin();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Workouts
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Build routines of movements, then assign each to a person on the days
          they train. Assigned routines appear as a daily workout to log and
          check off, and count on that person&rsquo;s card.
        </p>
      </header>

      <ExerciseAdmin routines={routines} roster={roster} assignments={assignments} />
    </main>
  );
}
