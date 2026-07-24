import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadDay, loadOpenTasks } from "@/lib/queries/overview";
import { addDays, formatLong, todayISO } from "@/lib/dates";
import { PersonCard } from "@/components/person-card";
import { AddTaskForm } from "@/components/add-task-form";
import { generateChores } from "@/lib/chores/generate";
import { generatePoolChores } from "@/lib/chores/pool";
import { generateReadingTasks } from "@/lib/bible/generate";
import { IconButtonLink } from "@/components/ui";
import {
  ChoresIcon,
  AlertIcon,
  CalendarIcon,
  TrophyIcon,
  GamepadIcon,
  BookIcon,
} from "@/components/icons";
import { OpenTasks } from "@/components/open-tasks";
import { DaySchedule } from "@/components/day-schedule";
import { loadDaySchedule } from "@/lib/queries/calendar";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day } = await searchParams;
  const today = todayISO();

  // The person cards always show today; only the schedule strip moves, so
  // you can look ahead without losing sight of what's outstanding now.
  const scheduleDay =
    day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today;

  let people;
  try {
    // Idempotent: fills in any chore days not yet materialized. Cheap enough
    // to run on load, which avoids needing a scheduler.
    await generateChores(today);
    await generatePoolChores(today);
    await generateReadingTasks(today);
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
  const openTasks = await loadOpenTasks(today);
  const todaySchedule = await loadDaySchedule(scheduleDay);

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
          <IconButtonLink href="/summary" label="Summary and totals">
            <TrophyIcon />
          </IconButtonLink>
          <IconButtonLink href="/calendar" label="Calendar">
            <CalendarIcon />
          </IconButtonLink>
          <IconButtonLink href="/bible" label="Bible reading">
            <BookIcon />
          </IconButtonLink>
          <IconButtonLink href="/games" label="Game time">
            <GamepadIcon />
          </IconButtonLink>
          <IconButtonLink href="/chores" label="Chores overview">
            <ChoresIcon />
          </IconButtonLink>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <PersonCard key={p.id} person={p} />
        ))}
      </div>

      <div className="mt-10">
        <DaySchedule
          events={[...todaySchedule.allDay, ...todaySchedule.timed]}
          title={
            scheduleDay === today
              ? "Today's schedule"
              : formatLong(scheduleDay)
          }
          emptyText="Nothing scheduled."
          href={`/calendar?view=day&date=${scheduleDay}`}
          nav={{
            prevHref: `/?day=${addDays(scheduleDay, -1)}`,
            todayHref: "/",
            nextHref: `/?day=${addDays(scheduleDay, 1)}`,
          }}
        />
      </div>

      <OpenTasks tasks={openTasks} people={roster} />

      <div className="mt-8">
        <AddTaskForm people={roster} defaultDate={today} />
      </div>

    </main>
  );
}
