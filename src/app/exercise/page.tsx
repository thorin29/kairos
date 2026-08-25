import { generateWorkoutTasks } from "@/lib/workouts/generate";
import {
  loadWorkoutsBoard,
  loadExercisePool,
  loadMovementComparisons,
  loadHiitWorkoutsForBoard,
} from "@/lib/queries/workouts";
import { todayISO, dayOfWeek } from "@/lib/dates";
import { WorkoutsGrid } from "./workouts-grid";
import { CompareView } from "./compare-view";

export const dynamic = "force-dynamic";

export default async function WorkoutsPage() {
  const today = todayISO();
  await generateWorkoutTasks(today);
  const [board, pool, comparisons, hiitWorkouts] = await Promise.all([
    loadWorkoutsBoard(today),
    loadExercisePool(),
    loadMovementComparisons(),
    loadHiitWorkoutsForBoard(),
  ]);

  return (
    <>
      

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
              hiitWorkouts={hiitWorkouts}
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
