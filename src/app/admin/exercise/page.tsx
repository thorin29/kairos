import { AdminBack } from "@/components/admin-back";
import { AdminTabs, pickTab } from "@/components/admin-tabs";
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
import { WorkoutExpiry } from "./workout-expiry";
import { WorkoutExport } from "./workout-export";
import { getWorkoutOverdueDays } from "@/lib/settings";
import { libraryStatus, loadEquipment } from "@/lib/workouts/library-run";
import { loadGarageFeet } from "@/lib/workouts/program-run";
import { MovementLibrary, HouseholdEquipment, WorkoutsLibrary } from "./movement-library";
import { wodLibraryStatus } from "@/lib/workouts/wod-run";
import { sharedPlansForAdmin } from "@/lib/workouts/plan-share-run";
import { SharedPlans } from "./shared-plans";

export const dynamic = "force-dynamic";

export default async function AdminWorkoutsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const [{ people }, pool, weightUnits, hiitWorkouts, pendingShares, overdueDays, library, equipment, wods, sharedPlans, garageFeet] =
    await Promise.all([
      loadWorkoutAdmin(),
      loadExercisePool(),
      loadWeightUnits(),
      loadHiitWorkouts(),
      loadPendingHiitShares(),
      getWorkoutOverdueDays(),
      libraryStatus(),
      loadEquipment(),
      wodLibraryStatus(),
      sharedPlansForAdmin(),
      loadGarageFeet(),
    ]);

  // Tabs (v0.797) instead of one long page.
  const tabs = [
    { key: "exercises", label: "Exercises" },
    { key: "workouts", label: "Workouts", badge: pendingShares.length },
    { key: "equipment", label: "Equipment" },
    { key: "people", label: "People" },
  ];
  const tab = pickTab(tabs, (await searchParams).tab);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-4 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Workouts
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          The shared exercise pool, workouts, home gear, and each person&rsquo;s logged workouts.
        </p>
      </header>

      <AdminTabs base="/admin/exercise" tabs={tabs} active={tab} />

      <div className="space-y-10">
        {tab === "exercises" && (
          <>
            <ExercisePool pool={pool} weightUnits={weightUnits} />
            <MovementLibrary status={library} />
          </>
        )}
        {tab === "workouts" && (
          <>
            {pendingShares.length > 0 && <PendingShares shares={pendingShares} />}
            <WorkoutsLibrary status={wods} />
            <HiitWorkouts
              movements={pool.filter((p) => p.category === "HIIT")}
              workouts={hiitWorkouts}
            />
            {sharedPlans.length > 0 && <SharedPlans plans={sharedPlans} />}
          </>
        )}
        {tab === "equipment" && <HouseholdEquipment items={equipment} garageFeet={garageFeet} />}
        {tab === "people" && (
          <>
            <WorkoutAdmin people={people} />
            <WorkoutExpiry days={overdueDays} />
            <WorkoutExport />
          </>
        )}
      </div>
    </main>
  );
}
