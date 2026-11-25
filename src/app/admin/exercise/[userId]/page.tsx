import { notFound } from "next/navigation";
import { AdminBack } from "@/components/admin-back";
import { loadPersonWorkoutRecords } from "@/lib/queries/workouts";
import { PersonRecords } from "./person-records";

export const dynamic = "force-dynamic";

export default async function PersonWorkoutsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const data = await loadPersonWorkoutRecords(userId);
  if (!data.user) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack parent={{ href: "/admin/exercise?tab=people", label: "Workouts" }} />

      <header className="mb-8 mt-5 flex items-center gap-3 border-b border-hairline pb-5">
        <span
          aria-hidden
          className="h-8 w-1.5 rounded-full"
          style={{ backgroundColor: data.user.color }}
        />
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {data.user.name}&rsquo;s workouts
          </h1>
          <p className="mt-1 text-muted">
            Review their HIIT workouts (approve to share, rename, or delete) and
            their logged workouts. Deleting is permanent.
          </p>
        </div>
      </header>

      <PersonRecords data={data} />
    </main>
  );
}
