import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { loadExercisePool, loadHiitWorkoutsForBoard, loadWorkoutsBoard } from "@/lib/queries/workouts";
import { AreaHeader } from "@/components/area-page";
import { DumbbellIcon } from "@/components/icons";
import { WorkoutDay } from "./workout-day";

export const dynamic = "force-dynamic";

/** Workouts from the home tile (v0.800): a page with the side menu, not a pop-up. */
export default async function PersonWorkoutsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = todayISO();
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) notFound();
  await generateWorkoutTasks(today);
  const [board, pool, hiitWorkouts] = await Promise.all([loadWorkoutsBoard(today), loadExercisePool(), loadHiitWorkoutsForBoard()]);
  const person = board.people.find((p) => p.user.id === id);
  if (!person) notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <AreaHeader backHref={`/person/${id}`} icon={<DumbbellIcon className="h-5 w-5" />} color="#9f1239" title="Workouts" />
      <WorkoutDay person={person} pool={pool} hiitWorkouts={hiitWorkouts} unitSystem={board.unitSystem} todayISO={today} />
    </main>
  );
}
