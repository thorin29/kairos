import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadDay } from "@/lib/queries/overview";
import { formatLong, todayISO } from "@/lib/dates";
import { PersonCard } from "@/components/person-card";
import { AddTaskForm } from "@/components/add-task-form";
import { generateChores } from "@/lib/chores/generate";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = todayISO();

  let people;
  try {
    // Idempotent: fills in any chore days not yet materialized. Cheap enough
    // to run on load, which avoids needing a scheduler.
    await generateChores(today);
    people = await loadDay(today);
  } catch (e) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-xl border border-hairline bg-surface p-6">
          <h1 className="font-display text-xl font-semibold">
            Can&rsquo;t reach the database
          </h1>
          <p className="mt-2 text-sm text-muted">
            Check that DATABASE_URL points at the right host and that this
            container shares a network with Postgres.
          </p>
          <pre className="tabular mt-4 overflow-x-auto rounded bg-ground p-3 text-xs">
            {e instanceof Error ? e.message : "Unknown database error"}
          </pre>
        </div>
      </main>
    );
  }

  if (people.length === 0) redirect("/setup");

  const roster = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, color: true },
  });

  const totalOverdue = people.reduce((n, p) => n + p.overdue, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Today
          </h1>
          <p className="tabular mt-1 text-sm text-muted">{formatLong(today)}</p>
        </div>
        <div className="flex items-center gap-3">
          {totalOverdue > 0 && (
            <p className="tabular text-sm font-medium text-red-700">
              {totalOverdue} overdue
            </p>
          )}
          <Link
            href="/chores"
            className="rounded-md border border-hairline px-3 py-2 text-sm text-muted hover:border-accent hover:text-accent"
          >
            Chores
          </Link>
          <Link
            href="/setup"
            className="rounded-md border border-hairline px-3 py-2 text-sm text-muted hover:border-accent hover:text-accent"
          >
            Household
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <PersonCard key={p.id} person={p} />
        ))}
      </div>

      <div className="mt-8">
        <AddTaskForm people={roster} defaultDate={today} />
      </div>
    </main>
  );
}
