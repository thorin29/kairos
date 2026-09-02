import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadDay, loadOpenTasks } from "@/lib/queries/overview";
import { addDays, formatLong, todayISO } from "@/lib/dates";
import { PersonCard } from "@/components/person-card";
import { AddTaskForm } from "@/components/add-task-form";
import { generateChores } from "@/lib/chores/generate";
import { generateAnytimeChores } from "@/lib/chores/anytime";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { generatePoolChores } from "@/lib/chores/pool";
import { generateReadingTasks } from "@/lib/bible/generate";
import { AlertIcon } from "@/components/icons";
import { OpenTasks } from "@/components/open-tasks";
import { AlwaysOpenChores } from "@/components/always-open-chores";
import { loadAlwaysOpenChores } from "@/lib/queries/chores-summary";

import { DaySchedule } from "@/components/day-schedule";
import { loadDaySchedule } from "@/lib/queries/calendar";
import { deviceMode } from "@/lib/device";
import { currentUser } from "@/lib/user-session";
import { pendingSportPrompts, type SportPrompt } from "@/lib/workouts/generate";
import { loadRolloverState, pendingClassPrompts } from "@/lib/queries/school";
import { pendingMoneyCount } from "@/lib/queries/money";
import { loadDashboardTrips } from "@/lib/queries/groceries";
import { pendingBibleRewards } from "@/lib/bible-rewards";
import { clearPausedTasks } from "@/lib/queries/pauses";

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
    await generateWorkoutTasks(today);
    await generatePoolChores(today);
    await generateReadingTasks(today);
    await generateAnytimeChores(today);
    // Sweep any scheduled task that lands on a paused (vacation) day, including
    // days already past within the break that the generators don't revisit.
    await clearPausedTasks(today);
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

  // Personal mode (a phone) shows just the signed-in person; shared mode (the
  // wall tablet, and the default) shows the whole household as before. On a
  // personal device the home IS the person's card contents, so hand off to that
  // page (which carries the bars, reminders, up-for-grabs and schedule too).
  const me = await currentUser();
  const personal = (await deviceMode()) === "personal" && !!me;
  if (personal && me) redirect(`/person/${me.id}`);
  const shown = personal && me ? people.filter((p) => p.id === me.id) : people;

  const roster = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, color: true },
  });

  const totalOverdue = shown.reduce((n, p) => n + p.overdue, 0);

  const sportPrompts = await pendingSportPrompts(today);
  const promptsByUser = new Map<string, SportPrompt[]>();
  for (const p of sportPrompts) {
    const arr = promptsByUser.get(p.userId);
    if (arr) arr.push(p);
    else promptsByUser.set(p.userId, [p]);
  }
  const openTasks = await loadOpenTasks(today);
  const alwaysOpenChores = await loadAlwaysOpenChores(today);
  const todaySchedule = await loadDaySchedule(scheduleDay);

  // The "start a new semester" reminder rides each admin's card. It's the same
  // household-wide state as the Admin → School banner, so whichever admin acts
  // on it (or snoozes it) clears it for both.
  const rollover = await loadRolloverState(today);
  const adminIds = rollover.needed
    ? new Set(
        (
          await prisma.user.findMany({
            where: { role: "ADMIN", isActive: true },
            select: { id: true },
          })
        ).map((u) => u.id),
      )
    : new Set<string>();
  const rolloverReminder = { fromTermName: rollover.fromTerm?.name ?? null };

  // Transactions waiting on an admin ride every admin's card too, cleared for
  // all at once when approved. Bible-reading rewards ready to grant do the same.
  const moneyPending = await pendingMoneyCount();
  const bibleRewardsReady = (await pendingBibleRewards(today)).count;
  const moneyAdminIds =
    moneyPending > 0 || bibleRewardsReady > 0
      ? new Set(
          (
            await prisma.user.findMany({
              where: { role: "ADMIN", isActive: true },
              select: { id: true },
            })
          ).map((u) => u.id),
        )
      : new Set<string>();

  // Post-class prompts, grouped onto each student's card.
  const classPrompts = await pendingClassPrompts(today);
  const classPromptsByUser = new Map<string, typeof classPrompts>();
  for (const cp of classPrompts) {
    const arr = classPromptsByUser.get(cp.userId);
    if (arr) arr.push(cp);
    else classPromptsByUser.set(cp.userId, [cp]);
  }

  // Active shopping trips ride the shopper's card as a line into their cart.
  const dashboardTrips = await loadDashboardTrips();
  const tripsByUser = new Map<string, typeof dashboardTrips>();
  for (const t of dashboardTrips) {
    const arr = tripsByUser.get(t.shopperId);
    if (arr) arr.push(t);
    else tripsByUser.set(t.shopperId, [t]);
  }

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-6">
        {!personal && totalOverdue > 0 && (
          <p className="tabular mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-red-700">
            <AlertIcon className="h-4 w-4" />
            {totalOverdue} overdue
          </p>
        )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            prompts={promptsByUser.get(p.id) ?? []}
            rollover={adminIds.has(p.id) ? rolloverReminder : null}
            moneyPending={moneyAdminIds.has(p.id) ? moneyPending : 0}
            moneyBibleRewards={moneyAdminIds.has(p.id) ? bibleRewardsReady : 0}
            classPrompts={classPromptsByUser.get(p.id) ?? []}
            shoppingTrips={tripsByUser.get(p.id) ?? []}
            dateISO={today}
          />
        ))}
      </div>

      {!personal && (
        <div className="mt-8">
          <OpenTasks tasks={openTasks} people={roster} />
        </div>
      )}

      {!personal && (
        <div className="mt-8">
          <AlwaysOpenChores chores={alwaysOpenChores} people={roster} />
        </div>
      )}

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

      {!personal && (
        <div className="mt-8">
          <AddTaskForm people={roster} defaultDate={today} />
        </div>
      )}

    </main>
    </>
  );
}
