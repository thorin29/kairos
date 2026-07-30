import { AppHeader } from "@/components/app-header";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import {
  loadWorkoutsBoard,
  loadExercisePool,
  loadMovementComparisons,
} from "@/lib/queries/workouts";
import { todayISO, formatLong, dayOfWeek } from "@/lib/dates";
import { WorkoutsGrid } from "./workouts-grid";
import { CompareView } from "./compare-view";

export const dynamic = "force-dynamic";

export default async function WorkoutsPage() {
  const today = todayISO();
  await generateWorkoutTasks(today);
  const [board, pool, comparisons] = await Promise.all([
    loadWorkoutsBoard(today),
    loadExercisePool(),
    loadMovementComparisons(),
  ]);

  return (
    <>
      <AppHeader title="Workouts" subtitle={formatLong(today)} active="exercise" />

      <main className="mx-auto max-w-5xl px-6 py-6">
        {board.people.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
            Add people to the household to start tracking workouts.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              Tap a card to open the plan and log a session.
            </p>
            <WorkoutsGrid
              people={board.people}
              unitSystem={board.unitSystem}
              pool={pool}
              todayISO={today}
              todayDow={dayOfWeek(today)}
            />

            {comparisons.length > 0 && (
              <div className="mt-8">
                <CompareView movements={comparisons} />
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
