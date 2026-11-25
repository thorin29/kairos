import { planWeekday } from "@/lib/workouts/day-swap";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadPersonDay } from "@/lib/queries/overview";
import { loadPersonProgress } from "@/lib/queries/progression";
import { getMonthGoalDays } from "@/lib/settings";
import { fmtGrowth } from "@/lib/companions-growth";
import { loadGetAhead } from "@/lib/queries/get-ahead";
import { loadSchoolGetAhead } from "@/lib/queries/school-get-ahead";
import { loadSchoolProgress } from "@/lib/queries/school-card";
import { SchoolTile } from "@/components/school-card";
import { ChoresTile } from "@/components/chores-card";
import {
  loadWorkoutPlanNames,
  loadWorkoutDayExtras,
} from "@/lib/queries/workouts";
import { loadDayPlanProgress, loadOverdueWorkoutDates, workoutBlocksFor, workoutRestFor } from "@/lib/queries/workout-log";
import { loadReadingProgress } from "@/lib/queries/reading";
import { WorkoutTile } from "@/components/workout-tile";
import { syncCoreDays } from "@/lib/workouts/core-run";
import { swapsFor } from "@/lib/workouts/day-swap-run";
import { ProgramCard } from "@/app/exercise/program-card";
import { inviteFor } from "@/lib/workouts/program-run";
import { loadActivePause } from "@/lib/queries/pauses";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/colors";
import {
  formatLong,
  todayISO,
} from "@/lib/dates";

import { generateChores } from "@/lib/chores/generate";
import { generateAnytimeChores } from "@/lib/chores/anytime";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { generatePoolChores } from "@/lib/chores/pool";
import { generateReadingTasks } from "@/lib/bible/generate";
import { loadPersonalPlan } from "@/lib/queries/personal-plan";
import { AddTaskForm } from "@/components/add-task-form";
import { Card } from "@/components/ui";
import { Companion } from "@/components/companion";
import { HatchControls } from "@/components/hatch-controls";
import { deviceMode } from "@/lib/device";
import { DaySchedule } from "@/components/day-schedule";
import { ShoppingReminder } from "@/components/shopping-reminder";
import { SportPrompts } from "@/components/sport-prompts";
import { ClassPrompts } from "@/components/class-prompts";
import { MoneyReminder } from "@/components/money-reminder";
import { RolloverReminder } from "@/components/rollover-reminder";
import { loadOpenTasks } from "@/lib/queries/overview";
import { loadAlwaysOpenChores, loadChoreBadges } from "@/lib/queries/chores-summary";
import { loadDaySchedule } from "@/lib/queries/calendar";
import { pendingSportPrompts } from "@/lib/workouts/generate";
import { pendingClassPrompts, loadRolloverState } from "@/lib/queries/school";
import { pendingMoneyCount } from "@/lib/queries/money";
import { pendingBibleRewards } from "@/lib/bible-rewards";
import { loadDashboardTrips } from "@/lib/queries/groceries";
import { Suspense } from "react";
import { GreetingCard } from "@/components/greeting-card";
import { HomeTile } from "@/components/home-tile";
import { ListTile } from "@/components/list-tile";
import { FamilyGoalBanner } from "@/components/family-goal-banner";
import { workoutCard } from "@/lib/workouts/day-card";
import { personRows } from "@/lib/queries/person-rows";
import { MoonIcon, FlameIcon, StarIcon, BookIcon } from "@/components/icons";
import {
  ChoresIcon,
  BibleIcon,
  SchoolIcon,
  DumbbellIcon,
  TasksIcon,
  CalendarIcon,
} from "@/components/icons";

// Category headers use the same icons + colors as the side menu, so the home
// sections read consistently with the nav.
const CAT_ICON: Record<string, { Icon: typeof ChoresIcon; color: string }> = {
  BIBLE: { Icon: BibleIcon, color: "#7c3aed" },
  CHORE: { Icon: ChoresIcon, color: "#ea580c" },
  SCHOOL: { Icon: SchoolIcon, color: "#4f46e5" },
  EXERCISE: { Icon: DumbbellIcon, color: "#9f1239" },
  WORK: { Icon: TasksIcon, color: "#334155" },
  APPOINTMENT: { Icon: CalendarIcon, color: "#2563eb" },
  OTHER: { Icon: TasksIcon, color: "#64748b" },
};

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
  await searchParams;
  const today = todayISO();

  // On a personal device the character lives on the Character page, so it comes
  // off the card here.
  const onPersonalDevice = (await deviceMode()) === "personal";

  const person = await prisma.user.findUnique({ where: { id } });
  if (!person) notFound();

  // The "Personal Bible Reading" tracker is on every person's page and logs to
  // that person — the household way (like chores), so on the shared wall tablet
  // anyone can record their own reading from their own card.
  const personalPlan = await loadPersonalPlan(id);
  const personalToday =
    personalPlan?.days.find((d) => d.iso === today) ?? null;

  // Self-healing: if this page is opened before the dashboard, today's
  // chores still get created.
  await generateChores(today);
  await generateWorkoutTasks(today);
  await generatePoolChores(today);
  await generateReadingTasks(today);
  await generateAnytimeChores(today);

  const tasks = await loadPersonDay(id, today);
  const workoutNames = await loadWorkoutPlanNames(id);
  const activePause = await loadActivePause(today);
  const [progress, monthTarget] = await Promise.all([loadPersonProgress(id), getMonthGoalDays()]);
  const getAhead = await loadGetAhead(id, today);
  const choreBadges = await loadChoreBadges(id, today);
  // Up-for-grabs + always-open are household pool chores shown on every person's
  // card (one-tap complete for them), so load them regardless of device.
  const choreOpenTasks = await loadOpenTasks(today, id);
  const choreAlwaysOpen = await loadAlwaysOpenChores(today, id);
  const schoolAhead = await loadSchoolGetAhead(id, today);
  const schoolProgress = await loadSchoolProgress(id);

  // Core days move on to the workout now due before the plan's names are read.
  await syncCoreDays(id, today);
  const [swaps, overdueWorkoutDays, readingProgress] = await Promise.all([
    swapsFor(id),
    loadOverdueWorkoutDates(id, today),
    loadReadingProgress(id),
  ]);
  // A rest day (v0.650): the plan's Rest or Rest / skip pressed. The card reads
  // "Rest day!", or "Complete for today!" when a skipped day got something else.
  const restToday = await workoutRestFor(id, today);
  // Started but not finished (v0.716): what's left, for the workout card.
  const progressToday = restToday.rest ? null : await loadDayPlanProgress(id, today);
  const workoutLeft =
    progressToday && progressToday.logged && !progressToday.done ? progressToday.remaining : [];
  // Two or more workouts today (v0.745): "1 of 2 workouts"; a skipped one counts.
  const blocksToday = restToday.rest === "planned" ? null : await workoutBlocksFor(id, today);
  const dayExtras = blocksToday ? ((await loadWorkoutDayExtras(id)).get(planWeekday(swaps, today)) ?? []) : [];
  const restDayToday = !blocksToday && restToday.rest != null && !(restToday.rest === "skipped" && restToday.extraLogged);
  // "Start a workout program?" for someone with no plan and nothing logged lately.
  const showInvite = await inviteFor(id);

  const rows = personRows(tasks, today, (dueISO) => workoutNames.get(planWeekday(swaps, dueISO)));

  const overdue = rows.filter((r) => r.isOverdue);
  const todayRows = rows.filter((r) => !r.isOverdue && !r.stale);

  // School gets its own card, so keep it out of the general overdue list and the
  // per-category day sections.
  const schoolOverdue = overdue.filter((r) => r.category === "SCHOOL");
  const schoolToday = todayRows.filter((r) => r.category === "SCHOOL");

  // The greeting card's chips and ring (v0.799; school left out, as before).
  const catBars = ORDER.map((category) => {
        const items = rows.filter(
          (r) =>
            r.category === category &&
            r.status !== "SKIPPED" &&
            !r.stale &&
            r.category !== "SCHOOL",
        );
        const total = items.length;
        const complete = items.filter((r) => r.status === "COMPLETE").length;
        const overdueN = items.filter((r) => r.isOverdue).length;
        return {
          category,
          total,
          complete,
          overdue: overdueN,
          percent: total ? Math.round((complete / total) * 100) : 0,
        };
      }).filter((c) => c.total > 0 || c.overdue > 0);

  // This page is the home on a personal device, so it also carries the
  // up-for-grabs / always-open chores, the reminder lines, and the schedule
  // that otherwise live on the shared dashboard.
  let home: {
    openTasks: Awaited<ReturnType<typeof loadOpenTasks>>;
    alwaysOpen: Awaited<ReturnType<typeof loadAlwaysOpenChores>>;
    roster: { id: string; name: string; color: string }[];
    schedule: Awaited<ReturnType<typeof loadDaySchedule>>;
    trips: Awaited<ReturnType<typeof loadDashboardTrips>>;
    sport: Awaited<ReturnType<typeof pendingSportPrompts>>;
    classPrompts: Awaited<ReturnType<typeof pendingClassPrompts>>;
    moneyPending: number;
    bibleReady: number;
    rolloverName: string | null;
  } | null = null;
  if (onPersonalDevice) {
    const [openTasks, alwaysOpen, roster, schedule, trips, sport, classP] =
      await Promise.all([
        loadOpenTasks(today, id),
        loadAlwaysOpenChores(today, id),
        prisma.user.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, color: true },
        }),
        loadDaySchedule(today),
        loadDashboardTrips(),
        pendingSportPrompts(today),
        pendingClassPrompts(today),
      ]);
    const isAdmin = person.role === "ADMIN";
    const moneyPending = isAdmin ? await pendingMoneyCount() : 0;
    const bibleReady = isAdmin ? (await pendingBibleRewards(today)).count : 0;
    const rollover = isAdmin ? await loadRolloverState(today) : null;
    home = {
      openTasks,
      alwaysOpen,
      roster,
      schedule,
      trips: trips.filter((t) => t.shopperId === id),
      sport: sport.filter((s) => s.userId === id),
      classPrompts: classP.filter((c) => c.userId === id),
      moneyPending,
      bibleReady,
      rolloverName: rollover?.needed ? (rollover.fromTerm?.name ?? null) : null,
    };
  }

  const byDate = (a: (typeof rows)[number], b: (typeof rows)[number]) => a.dueDateISO.localeCompare(b.dueDateISO);
  // Overdue work sits with its own area, oldest first, ahead of today's.
  const catOverdue = (c: string) => overdue.filter((r) => r.category === c).sort(byDate);
  const catToday = (c: string) => todayRows.filter((r) => r.category === c);
  const catRows = (c: string) => [...catOverdue(c), ...catToday(c)];
  const lines = (c: string) =>
    catRows(c).map((r) => ({
      id: r.id,
      title: r.title,
      sub: r.subtitle ?? null,
      done: r.status === "COMPLETE",
      late: r.isOverdue,
      dueISO: r.dueDateISO,
    }));

  const todayEx = catToday("EXERCISE");
  const overdueEx = catOverdue("EXERCISE");
  const exCard = blocksToday ? workoutCard(blocksToday.items, todayEx[0]?.title ?? null, dayExtras) : null;

  // The areas as tiles (v0.799), in the app's order: Bible, Reading, Chores,
  // School, Workouts, then Tasks and the rest.
  const tiles: React.ReactNode[] = [];
  if (catRows("BIBLE").length > 0 || personalToday) {
    tiles.push(
      <ListTile
        key="bible"
        icon={<BibleIcon className="h-[18px] w-[18px]" />}
        color={CATEGORY_COLORS.BIBLE}
        label="Bible"
        href={`/person/${id}/bible`}
        lines={lines("BIBLE")}
        personal={personalToday ? { userId: id, passage: personalToday.passage, dayISO: personalToday.iso, read: personalToday.read } : null}
      />,
    );
  }
  if (readingProgress.length > 0) {
    tiles.push(
      <HomeTile key="reading" icon={<BookIcon className="h-[18px] w-[18px]" />} color="#0891b2" label="Reading" href="/reading">
        {readingProgress.slice(0, 3).map((r) => (
          <span key={r.bookId} className="block">
            <span className="block truncate text-sm font-medium">{r.title}</span>
            <span className="mt-1 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, r.pct))}%`, backgroundColor: r.behind ? "#b91c1c" : "#0891b2" }}
                />
              </span>
              <span className={`tabular w-9 shrink-0 text-right text-xs ${r.behind ? "font-medium text-red-700" : "text-muted"}`}>{r.pct}%</span>
            </span>
          </span>
        ))}
      </HomeTile>,
    );
  }
  if (catRows("CHORE").length > 0 || getAhead.length > 0 || choreOpenTasks.length > 0 || choreAlwaysOpen.length > 0) {
    tiles.push(
      <ChoresTile
        key="chore"
        overdue={catOverdue("CHORE")}
        today={catToday("CHORE")}
        openTitles={choreOpenTasks.map((t) => t.title)}
        badges={choreBadges}
        href={`/person/${id}/chores`}
      />,
    );
  }
  if (schoolOverdue.length > 0 || schoolToday.length > 0 || schoolProgress.progress.length > 0 || schoolAhead.length > 0) {
    tiles.push(
      <SchoolTile key="school" overdue={schoolOverdue} today={schoolToday} href={`/person/${id}/school`} />,
    );
  }
  if (todayEx.length > 0 || overdueEx.length > 0 || restToday.rest != null || blocksToday) {
    tiles.push(
      <WorkoutTile
        key="exercise"
        href={`/person/${id}/workouts`}
        names={restToday.rest ? [] : todayEx.filter((r) => r.status !== "COMPLETE").map((r) => r.title)}
        card={exCard}
        blocks={blocksToday}
        remaining={workoutLeft}
        restDay={restDayToday}
        overdueCount={overdueWorkoutDays.length}
        // Same rule as the phone's tile: today's workout is complete (or
        // something else logged on a skipped day) and nothing is overdue.
        completeForToday={
          !restDayToday &&
          overdueWorkoutDays.length === 0 &&
          (blocksToday
            ? blocksToday.done === blocksToday.total
            : (restToday.rest === "skipped" && restToday.extraLogged) ||
              (todayEx.length > 0 && todayEx.every((r) => r.status === "COMPLETE")))
        }
      />,
    );
  }
  for (const c of ["WORK", "APPOINTMENT", "OTHER"] as const) {
    if (catRows(c).length === 0) continue;
    const cfg = CAT_ICON[c];
    tiles.push(
      <ListTile
        key={c}
        icon={<cfg.Icon className="h-[18px] w-[18px]" />}
        color={CATEGORY_COLORS[c]}
        label={c === "WORK" ? "Tasks" : CATEGORY_LABELS[c]}
        href={`/person/${id}/tasks`}
        lines={lines(c)}
      />,
    );
  }

  const levelChips = progress ? (
    <>
      <span className="tabular inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-xs font-semibold">
        <StarIcon className="h-3.5 w-3.5 text-accent" />
        Level {progress.level.level} &middot; {fmtGrowth(progress.monthlyCredit)}/{monthTarget} days
      </span>
      {progress.currentStreak > 0 && (
        <span
          className="tabular inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-xs font-semibold text-orange-600"
          title={progress.longestStreak > progress.currentStreak ? `Best streak: ${progress.longestStreak} days` : "Days in a row with everything done"}
        >
          <FlameIcon className="h-3.5 w-3.5" />
          {progress.currentStreak}
        </span>
      )}
    </>
  ) : null;

  const hasReminders =
    home &&
    (home.trips.length > 0 ||
      home.sport.length > 0 ||
      home.classPrompts.length > 0 ||
      home.moneyPending > 0 ||
      home.bibleReady > 0 ||
      home.rolloverName !== null);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          <GreetingCard
            person={{
              id: person.id,
              name: person.displayName ?? person.name,
              color: person.color,
              avatarPath: person.avatarPath,
              avatarPosition: person.avatarPosition,
            }}
            dateLabel={formatLong(today).replace(/, \d{4}$/, "")}
            bars={catBars}
            extra={levelChips}
          />

          {home && hasReminders && (
            <div className="space-y-3">
              {home.trips.length > 0 && <ShoppingReminder trips={home.trips} />}
              {home.rolloverName !== null && <RolloverReminder fromTermName={home.rolloverName} />}
              {(home.moneyPending > 0 || home.bibleReady > 0) && (
                <MoneyReminder count={home.moneyPending} bibleRewards={home.bibleReady} />
              )}
              {home.classPrompts.length > 0 && <ClassPrompts prompts={home.classPrompts} today={today} />}
              {home.sport.length > 0 && <SportPrompts prompts={home.sport} dateISO={today} />}
            </div>
          )}

          {activePause && (
            <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4">
              <MoonIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="font-display text-sm font-semibold text-accent">Paused for {activePause.name}</p>
                <p className="mt-0.5 text-sm text-muted">
                  Chores and workouts are off while you&rsquo;re away. They pick back up the day after the break ends.
                </p>
              </div>
            </div>
          )}

          {tiles.length === 0 ? (
            <Card className="p-6 text-sm text-muted">Nothing scheduled today.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">{tiles}</div>
          )}

          <Suspense fallback={null}>
            <FamilyGoalBanner />
          </Suspense>

          {showInvite && <ProgramCard userId={id} inviteOnly />}

          {progress && !onPersonalDevice && (
            <div className="flex flex-col items-center">
              <Companion companion={progress.companion} colorHex={progress.companionColor} />
              {progress.companion.eggReady && <HatchControls userId={person.id} phase={progress.companion.phase} />}
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          {home && (
            <DaySchedule
              events={[...home.schedule.allDay, ...home.schedule.timed]}
              title="Today's schedule"
              emptyText="Nothing scheduled."
              href={`/calendar?view=day&date=${today}`}
            />
          )}
          <AddTaskForm
            people={[{ id: person.id, name: person.name, color: person.color }]}
            defaultUserId={person.id}
            defaultDate={today}
          />
        </aside>
      </div>
    </main>
  );
}
