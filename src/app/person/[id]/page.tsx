import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadPersonDay } from "@/lib/queries/overview";
import { CATEGORY_LABELS } from "@/lib/colors";
import {
  addDays,
  formatLong,
  fromDateColumn,
  startOfWeek,
  todayISO,
  weekDays,
} from "@/lib/dates";
import { loadRange, loadTasksForDays } from "@/lib/queries/calendar";
import { PersonWeek } from "@/components/person-week";
import { generateChores } from "@/lib/chores/generate";
import { TaskRow } from "@/components/task-row";
import { AddTaskForm } from "@/components/add-task-form";
import { BackLink, DoneBar } from "@/components/back-link";
import { Card, SectionHeading, IconButtonLink } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { SettingsIcon } from "@/components/icons";
import { CATEGORY_COLORS } from "@/lib/colors";

export const dynamic = "force-dynamic";

/** Order the day reads in. Chores first because they're the daily habit. */
const ORDER = [
  "CHORE",
  "BIBLE",
  "EXERCISE",
  "SCHOOL",
  "WORK",
  "APPOINTMENT",
  "OTHER",
] as const;

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  const { week } = await searchParams;
  const today = todayISO();

  const weekAnchor = startOfWeek(
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today,
  );

  const person = await prisma.user.findUnique({ where: { id } });
  if (!person) notFound();

  // Self-healing: if this page is opened before the dashboard, today's
  // chores still get created.
  await generateChores(today);

  const tasks = await loadPersonDay(id, today);

  const days = weekDays(weekAnchor);
  const [weekRange, weekTasks] = await Promise.all([
    loadRange(days, id),
    loadTasksForDays(days, id),
  ]);

  const rows = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category as keyof typeof CATEGORY_LABELS,
    status: t.status as string,
    dueDateISO: fromDateColumn(t.dueDate),
    isOverdue:
      fromDateColumn(t.dueDate) < today && t.status === "PENDING" && !t.stale,
    stale: t.stale,
    locked: Boolean(t.choreId),
  }));

  const counted = rows.filter((r) => r.status !== "SKIPPED" && !r.stale);
  const done = counted.filter((r) => r.status === "COMPLETE").length;
  const percent = counted.length
    ? Math.round((done / counted.length) * 100)
    : null;

  const overdue = rows.filter((r) => r.isOverdue);
  const missed = rows.filter((r) => r.stale);
  const todayRows = rows.filter((r) => !r.isOverdue && !r.stale);

  // Grouped so the day reads as sections rather than one long list.
  const groups = ORDER.map((category) => ({
    category,
    items: todayRows.filter((r) => r.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <BackLink />

      <header className="mb-8 mt-5 flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-5">
        <div className="flex items-center gap-3">
          <Avatar
            name={person.displayName ?? person.name}
            color={person.color}
            avatarPath={person.avatarPath}
            size="lg"
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
        <div className="ml-auto flex items-center gap-3">
          <IconButtonLink
            href={`/person/${person.id}/profile`}
            label="Edit profile"
            variant="outlined"
          >
            <SettingsIcon />
          </IconButtonLink>
          <div className="text-right">
          <p className="tabular text-3xl font-medium leading-none">
            {percent === null ? (
              <span className="text-base text-muted">Nothing today</span>
            ) : (
              `${percent}%`
            )}
          </p>
          {counted.length > 0 && (
            <p className="tabular mt-1 text-xs text-muted">
              {done} of {counted.length} done
            </p>
          )}
          </div>
        </div>
      </header>

      {overdue.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-red-700">
            Carried over
          </h2>
          <Card className="divide-y divide-hairline border-red-200">
            {overdue.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </Card>
        </section>
      )}

      {groups.length > 0 ? (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.category}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[g.category] }}
                />
                <SectionHeading>{CATEGORY_LABELS[g.category]}</SectionHeading>
              </div>
              <Card className="divide-y divide-hairline">
                {g.items.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Card>
            </section>
          ))}
        </div>
      ) : (
        overdue.length === 0 && (
          <Card className="p-6 text-sm text-muted">
            Nothing scheduled today.
          </Card>
        )
      )}

      {missed.length > 0 && (
        <section className="mt-8">
          <SectionHeading>Missed</SectionHeading>
          <Card className="divide-y divide-hairline opacity-60">
            {missed.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </Card>
          <p className="mt-2 text-xs text-muted">
            Someone else has these now, or they came around again. They no
            longer count either way.
          </p>
        </section>
      )}

      <div className="mt-10">
        <PersonWeek
          days={days}
          events={[...weekRange.allDay, ...weekRange.timed]}
          tasks={weekTasks}
          todayISO={today}
          label="This week"
          prevHref={`/person/${id}?week=${addDays(weekAnchor, -7)}`}
          nextHref={`/person/${id}?week=${addDays(weekAnchor, 7)}`}
          thisWeekHref={`/person/${id}`}
          fullHref={`/calendar?who=${id}`}
        />
      </div>

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
