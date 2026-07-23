import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadDay, loadOpenTasks } from "@/lib/queries/overview";
import { formatLong, todayISO } from "@/lib/dates";
import { PersonCard } from "@/components/person-card";
import { AddTaskForm } from "@/components/add-task-form";
import { generateChores } from "@/lib/chores/generate";
import { loadScores } from "@/lib/queries/scoreboard";
import { IconButtonLink, Card } from "@/components/ui";
import {
  ChoresIcon,
  PeopleIcon,
  AlertIcon,
  CalendarIcon,
} from "@/components/icons";
import { OpenTasks } from "@/components/open-tasks";

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
  const scores = await loadScores(today);
  const openTasks = await loadOpenTasks(today);
  const anyActivity = scores.some((s) => s.assigned > 0);

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
            <p className="tabular inline-flex items-center gap-1.5 text-sm font-medium text-red-700">
              <AlertIcon className="h-4 w-4" />
              {totalOverdue} overdue
            </p>
          )}
          <IconButtonLink href="/calendar" label="Calendar">
            <CalendarIcon />
          </IconButtonLink>
          <IconButtonLink href="/chores" label="Manage chores">
            <ChoresIcon />
          </IconButtonLink>
          <IconButtonLink href="/setup" label="Manage household">
            <PeopleIcon />
          </IconButtonLink>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <PersonCard key={p.id} person={p} />
        ))}
      </div>

      <OpenTasks tasks={openTasks} people={roster} />

      <div className="mt-8">
        <AddTaskForm people={roster} defaultDate={today} />
      </div>

      {anyActivity && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
            Running totals
          </h2>
          <Card className="divide-y divide-hairline">
            {scores.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  aria-hidden
                  className="h-5 w-1.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="min-w-[6rem] flex-1 text-sm font-medium">
                  {s.name}
                </span>
                <span className="tabular w-24 text-right text-sm text-muted">
                  {s.assigned}
                  <span className="ml-1 text-xs">assigned</span>
                </span>
                <span className="tabular w-20 text-right text-sm text-muted">
                  {s.assignedChores}
                  <span className="ml-1 text-xs">chores</span>
                </span>
                <span className="tabular w-16 text-right text-sm">
                  {s.completed}
                  <span className="ml-1 text-xs text-muted">done</span>
                </span>
                <span className="tabular w-20 text-right text-sm">
                  {s.missed > 0 ? (
                    <span className="text-red-700">{s.missed}</span>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                  <span className="ml-1 text-xs text-muted">missed</span>
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </main>
  );
}
