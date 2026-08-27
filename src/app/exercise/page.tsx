import { generateWorkoutTasks } from "@/lib/workouts/generate";
import {
  loadWorkoutsBoard,
  loadExercisePool,
  loadMovementComparisons,
  loadHiitWorkoutsForBoard,
} from "@/lib/queries/workouts";
import { todayISO, dayOfWeek, weekDays as weekDaysOf } from "@/lib/dates";
import { personalUserId } from "@/lib/personal-scope";
import { loadWeeklyActivity } from "@/lib/queries/weekly-activity";
import { WorkoutsGrid } from "./workouts-grid";
import { CompareView } from "./compare-view";

export const dynamic = "force-dynamic";

export default async function WorkoutsPage() {
  const today = todayISO();
  await generateWorkoutTasks(today);
  const [board, pool, comparisons, hiitWorkouts, meId] = await Promise.all([
    loadWorkoutsBoard(today),
    loadExercisePool(),
    loadMovementComparisons(),
    loadHiitWorkoutsForBoard(),
    personalUserId(),
  ]);

  // Personal device: only the signed-in person, and the page opens straight
  // into their workout detail (no grid to tap through).
  const personal = meId != null && board.people.some((p) => p.user.id === meId);
  const people = personal
    ? board.people.filter((p) => p.user.id === meId)
    : board.people;
  const weeklyActivity =
    personal && meId ? await loadWeeklyActivity(meId, weekDaysOf(today)) : [];

  return (
    <>
      

      <main className="mx-auto max-w-5xl px-6 py-6">
        {board.people.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
            Add people to the household to start tracking workouts.
          </p>
        ) : (
          <>
            <WorkoutsGrid
              people={people}
              personal={personal}
              weeklyActivity={weeklyActivity}
              unitSystem={board.unitSystem}
              pool={pool}
              hiitWorkouts={hiitWorkouts}
              todayISO={today}
              todayDow={dayOfWeek(today)}
            />

            {!personal && comparisons.length > 0 && (
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
