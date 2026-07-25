import { AppHeader } from "@/components/app-header";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { loadWorkoutsBoard } from "@/lib/queries/workouts";
import { todayISO, formatLong } from "@/lib/dates";
import { WorkoutCard } from "./workout-card";

export const dynamic = "force-dynamic";

export default async function WorkoutsPage() {
  const today = todayISO();
  await generateWorkoutTasks(today);
  const board = await loadWorkoutsBoard(today);

  return (
    <>
      <AppHeader title="Workouts" subtitle={formatLong(today)} active="exercise" />

      <main className="mx-auto max-w-3xl space-y-5 px-6 py-6">
        {board.people.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
            Add people to the household to start tracking workouts.
          </p>
        ) : (
          board.people.map((p) => (
            <WorkoutCard
              key={p.user.id}
              person={p}
              unitSystem={board.unitSystem}
              todayISO={today}
            />
          ))
        )}
      </main>
    </>
  );
}
