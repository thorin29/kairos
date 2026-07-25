import { AppHeader } from "@/components/app-header";
import { generateExercise } from "@/lib/exercise/generate";
import { loadWorkoutDay } from "@/lib/queries/exercise";
import { todayISO, formatLong } from "@/lib/dates";
import { WorkoutBoard } from "./workout-board";

export const dynamic = "force-dynamic";

export default async function ExercisePage() {
  const today = todayISO();
  await generateExercise(today);
  const cards = await loadWorkoutDay(today);

  return (
    <>
      <AppHeader title="Workouts" subtitle={formatLong(today)} active="exercise" />

      <main className="mx-auto max-w-3xl px-6 py-6">
        {cards.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
            No workouts scheduled for today. A parent can build routines and
            assign them from the admin area.
          </p>
        ) : (
          <WorkoutBoard cards={cards} />
        )}
      </main>
    </>
  );
}
