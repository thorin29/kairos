import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadPersonDay } from "@/lib/queries/overview";
import { CATEGORY_LABELS } from "@/lib/colors";
import { formatLong, fromDateColumn, todayISO } from "@/lib/dates";
import { TaskRow } from "@/components/task-row";
import { AddTaskForm } from "@/components/add-task-form";
import { BackLink, DoneBar } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const today = todayISO();

  const person = await prisma.user.findUnique({ where: { id } });
  if (!person) notFound();

  const tasks = await loadPersonDay(id, today);

  const rows = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category as keyof typeof CATEGORY_LABELS,
    status: t.status as string,
    dueDateISO: fromDateColumn(t.dueDate),
    isOverdue:
      fromDateColumn(t.dueDate) < today && t.status === "PENDING" && !t.stale,
    stale: t.stale,
  }));

  const counted = rows.filter((r) => r.status !== "SKIPPED" && !r.stale);
  const done = counted.filter((r) => r.status === "COMPLETE").length;
  const percent = counted.length
    ? Math.round((done / counted.length) * 100)
    : null;

  const overdue = rows.filter((r) => r.isOverdue);
  const missed = rows.filter((r) => r.stale);
  const rest = rows.filter((r) => !r.isOverdue && !r.stale);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <BackLink />

      <header className="mb-8 mt-5 flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-9 w-1.5 rounded-full"
            style={{ backgroundColor: person.color }}
          />
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {person.displayName ?? person.name}
            </h1>
            <p className="tabular mt-1 text-sm text-muted">
              {formatLong(today)}
            </p>
          </div>
        </div>
        <p className="tabular text-2xl font-medium">
          {percent === null ? (
            <span className="text-base text-muted">Nothing today</span>
          ) : (
            `${percent}%`
          )}
        </p>
      </header>

      {overdue.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-700">
            Carried over
          </h2>
          <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-red-200 bg-surface">
            {overdue.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </section>
      )}

      {rest.length > 0 ? (
        <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface">
          {rest.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      ) : (
        overdue.length === 0 && (
          <p className="rounded-xl border border-hairline bg-surface p-6 text-sm text-muted">
            Nothing scheduled. Add something below.
          </p>
        )
      )}

      {missed.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            Missed
          </h2>
          <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface opacity-60">
            {missed.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            These expired or came around again. They no longer count either
            way.
          </p>
        </section>
      )}

      <div className="mt-8">
        <AddTaskForm
          people={[{ id: person.id, name: person.name, color: person.color }]}
          defaultUserId={person.id}
          defaultDate={today}
        />
      </div>

      <DoneBar />
    </main>
  );
}
