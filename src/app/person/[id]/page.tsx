import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { loadPersonDay } from "@/lib/queries/overview";
import { loadPersonProgress } from "@/lib/queries/progression";
import { loadGetAhead } from "@/lib/queries/get-ahead";
import { GetAheadRow } from "@/components/get-ahead-row";
import {
  loadWorkoutPlanNames,
  loadWorkoutsBoard,
  loadExercisePool,
  loadHiitWorkoutsForBoard,
} from "@/lib/queries/workouts";
import { WorkoutLauncher } from "./workout-launcher";
import { loadActivePause } from "@/lib/queries/pauses";
import { SCHOOL_TYPE_LABEL } from "@/lib/school";
import { loadClassOptions, loadSubjectNames } from "@/lib/queries/school";
import { CATEGORY_LABELS } from "@/lib/colors";
import {
  addDays,
  dayOfWeek,
  formatLong,
  formatShort,
  fromDateColumn,
  startOfWeek,
  todayISO,
  weekDays,
} from "@/lib/dates";
import { loadRange } from "@/lib/queries/calendar";
import { loadGameStatus } from "@/lib/queries/games";
import { GameTimeCard } from "@/components/game-time-card";
import { PersonWeek } from "@/components/person-week";
import { generateChores } from "@/lib/chores/generate";
import { generateAnytimeChores } from "@/lib/chores/anytime";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { generatePoolChores } from "@/lib/chores/pool";
import { generateReadingTasks } from "@/lib/bible/generate";
import { loadPersonalReadKeys } from "@/lib/queries/reading-stats";
import { PersonalReveal } from "@/components/personal-bible";
import { BookProgress } from "@/app/admin/bible/book-progress";
import { saveMyBookChapters, saveMyBooks } from "@/lib/actions/personal-bible";
import { TaskRow } from "@/components/task-row";
import { AddTaskForm } from "@/components/add-task-form";
import { AddSchoolWork } from "@/components/add-school-work";
import { Card, SectionHeading } from "@/components/ui";
import { Companion } from "@/components/companion";
import { HatchControls } from "@/components/hatch-controls";
import { Avatar } from "@/components/avatar";
import { LockIcon, MoonIcon, FlameIcon, StarIcon } from "@/components/icons";
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

  // The "Personal Bible Reading" tracker is on every person's page and logs to
  // that person — the household way (like chores), so on the shared wall tablet
  // anyone can record their own reading from their own card.
  const personalReadKeys = await loadPersonalReadKeys(id);

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
  const classOptions = await loadClassOptions();
  const subjectNames = await loadSubjectNames();
  const progress = await loadPersonProgress(id);
  const getAhead = await loadGetAhead(id, today);

  // Workout board data so a workout on the dashboard opens the same log step
  // as the Workouts page, scoped to each prompt's own day.
  const [board, pool, hiitWorkouts] = await Promise.all([
    loadWorkoutsBoard(today),
    loadExercisePool(),
    loadHiitWorkoutsForBoard(),
  ]);
  const boardPerson = board.people.find((p) => p.user.id === id) ?? null;
  const unitSystem = board.unitSystem;

  // For a workout prompt on day D: the plan for D's weekday, plus what's already
  // logged that day (today from live sessions, earlier days from history).
  function workoutDay(dateISO: string) {
    const dow = dayOfWeek(dateISO);
    const workouts = (boardPerson?.plan[dow]?.workouts ?? []).filter(
      (w) => !w.isRest,
    );
    if (dateISO === today) {
      return {
        workouts,
        doneLabels: boardPerson?.todayWorkouts.map((w) => w.label) ?? [],
        rested: boardPerson?.today.rested ?? false,
        paused: boardPerson?.today.paused ?? null,
      };
    }
    const hist = boardPerson?.history.filter((h) => h.dateISO === dateISO) ?? [];
    return {
      workouts,
      doneLabels: hist.filter((h) => !h.isRest).map((h) => h.label),
      rested: hist.some((h) => h.isRest),
      paused: null,
    };
  }

  const days = weekDays(weekAnchor);
  const weekRange = await loadRange(days, id);
  const [gameStatus] = await loadGameStatus(today, id);

  const rows = tasks.map((t) => {
    const dueISO = fromDateColumn(t.dueDate);
    // Name a workout prompt after the day's top planned workout; other tasks
    // keep their own title, and a plan-less workout day stays "Workout".
    const isWorkoutPrompt =
      t.category === "EXERCISE" && (t.generatedFrom ?? "").startsWith("workout:");
    const title = isWorkoutPrompt
      ? (workoutNames.get(dayOfWeek(dueISO)) ?? t.title)
      : t.title;

    // School items show their class or subject, type, and when they're due
    // (e.g. "Biology · Test · due 5/9") — handy while a window item sits as a
    // reminder before its due date.
    const sw = t.schoolWork;
    const subtitle =
      t.category === "SCHOOL" && sw
        ? [
            sw.class?.name ?? sw.subject,
            SCHOOL_TYPE_LABEL[sw.type],
            `due ${formatShort(dueISO)}`,
          ]
            .filter(Boolean)
            .join(" · ")
        : undefined;

    return {
      id: t.id,
      title,
      category: t.category as keyof typeof CATEGORY_LABELS,
      status: t.status as string,
      dueDateISO: dueISO,
      subtitle,
      isOverdue:
        (t.lateAfter
          ? today > fromDateColumn(t.lateAfter)
          : dueISO < today) &&
        t.status === "PENDING" &&
        !t.stale,
      stale: t.stale,
      locked: Boolean(t.choreId),
      isWorkout: isWorkoutPrompt,
      test:
        t.category === "SCHOOL" && sw?.type === "TEST"
          ? { score: sw.score ?? null, scoreMax: sw.scoreMax ?? 100 }
          : undefined,
    };
  });

  // School is tracked but not scored yet — keep it out of the header percent.
  const counted = rows.filter(
    (r) => r.status !== "SKIPPED" && !r.stale && r.category !== "SCHOOL",
  );
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

  // Workout prompts open the log step; everything else is a plain checklist row.
  const renderRow = (t: (typeof rows)[number]) => {
    if (t.isWorkout) {
      const wd = workoutDay(t.dueDateISO);
      return (
        <WorkoutLauncher
          key={t.id}
          userId={id}
          dateISO={t.dueDateISO}
          title={t.title}
          done={t.status === "COMPLETE"}
          overdue={t.isOverdue}
          workouts={wd.workouts}
          doneLabels={wd.doneLabels}
          rested={wd.rested}
          paused={wd.paused}
          pool={pool}
          hiitWorkouts={hiitWorkouts}
          unitSystem={unitSystem}
        />
      );
    }
    return <TaskRow key={t.id} task={t} />;
  };

  return (
    <>
      <AppHeader
        title={person.displayName ?? person.name}
        subtitle={formatLong(today)}
        active="home"
      />

      <main className="mx-auto max-w-3xl px-6 py-6">


      <div className="mb-8 flex flex-wrap items-center gap-4 border-b border-hairline pb-5">
        <Link
          href={`/person/${person.id}/profile`}
          title="Edit profile"
          aria-label={`Edit ${person.displayName ?? person.name}'s profile`}
          className="group relative rounded-full transition-transform hover:scale-105"
        >
          <Avatar
            name={person.displayName ?? person.name}
            color={person.color}
            avatarPath={person.avatarPath}
            size="lg"
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-ink/45 text-[0.6rem] font-semibold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
            Edit
          </span>
        </Link>

        {person.role === "ADMIN" && (
          <Link
            href="/admin"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <LockIcon className="h-4 w-4" />
            Admin
          </Link>
        )}

        {progress && (
          <span className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-sm">
            <StarIcon className="h-4 w-4 text-accent" />
            <span className="font-medium">Level {progress.level.level}</span>
            <span className="text-muted">{progress.className}</span>
            <span className="tabular text-muted">
              &middot; Season tier {progress.season.tier}/{progress.season.maxTier}
            </span>
            {progress.currentStreak > 0 && (
              <span
                className="tabular inline-flex items-center gap-1 font-medium text-orange-600"
                title={
                  progress.longestStreak > progress.currentStreak
                    ? `Best streak: ${progress.longestStreak} days`
                    : "Days in a row with everything done"
                }
              >
                <FlameIcon className="h-4 w-4" />
                {progress.currentStreak}
              </span>
            )}
          </span>
        )}

        <div className="ml-auto text-right">
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

      {progress && (
        <div className="mb-8 flex flex-col items-center">
          <Companion
            companion={progress.companion}
            colorHex={progress.companionColor}
            pct={progress.level.pct}
            shares={progress.statShares}
          />
          {progress.companion.eggReady && (
            <HatchControls userId={person.id} hasActive={progress.companion.active} />
          )}
        </div>
      )}

      {activePause && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4">
          <MoonIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="font-display text-sm font-semibold text-accent">
              Paused for {activePause.name}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Chores and workouts are off while you&rsquo;re away. They pick
              back up the day after the break ends.
            </p>
          </div>
        </div>
      )}

      {overdue.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-red-700">
            Carried over
          </h2>
          <Card className="divide-y divide-hairline border-red-200">
            {overdue.map(renderRow)}
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
                {g.items.map(renderRow)}
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

      {getAhead.length > 0 && (
        <section className="mt-8">
          <SectionHeading>Get ahead</SectionHeading>
          <Card className="divide-y divide-hairline">
            {getAhead.map((c) => (
              <GetAheadRow key={c.taskId} chore={c} />
            ))}
          </Card>
          <p className="mt-2 text-xs text-muted">
            Jump on an upcoming chore for a small bonus &mdash; only ones
            you&rsquo;re next up for. It still counts toward its own week; the
            bonus is on top, this week.
          </p>
        </section>
      )}

      {gameStatus?.enabled && (
        <div className="mt-8">
          <GameTimeCard status={gameStatus} />
        </div>
      )}

      <section className="mt-8">
        <SectionHeading>Bible reading</SectionHeading>
        <p className="mb-3 mt-1 text-sm text-muted">
          Log {person.name}&rsquo;s own reading &mdash; mark any chapters or whole
          books read, in any order. It adds a little to their Wisdom.
        </p>
        <PersonalReveal>
          <BookProgress
            initialManual={personalReadKeys}
            planCovered={[]}
            saveBook={saveMyBookChapters.bind(null, id)}
            saveBooks={saveMyBooks.bind(null, id)}
          />
        </PersonalReveal>
      </section>

      <div className="mt-10">
        <PersonWeek
          days={days}
          events={[...weekRange.allDay, ...weekRange.timed]}
          todayISO={today}
          label="This week"
          prevHref={`/person/${id}?week=${addDays(weekAnchor, -7)}`}
          nextHref={`/person/${id}?week=${addDays(weekAnchor, 7)}`}
          thisWeekHref={`/person/${id}`}
          fullHref={`/calendar?who=${id}`}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <AddTaskForm
          people={[{ id: person.id, name: person.name, color: person.color }]}
          defaultUserId={person.id}
          defaultDate={today}
        />
        <AddSchoolWork
          userId={person.id}
          classesByUser={classOptions}
          subjects={subjectNames}
          defaultDate={today}
        />
      </div>
    </main>
    </>
  );
}
