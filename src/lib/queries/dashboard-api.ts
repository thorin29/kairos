import "server-only";
import { Category, TaskStatus } from "@/generated/prisma/client";
import { loadPersonDay } from "@/lib/queries/overview";
import { loadWorkoutPlanNames } from "@/lib/queries/workouts";
import { SCHOOL_TYPE_LABEL } from "@/lib/school";
import { CATEGORY_LABELS } from "@/lib/colors";
import { dayOfWeek, formatShort, fromDateColumn } from "@/lib/dates";
import { generateChores } from "@/lib/chores/generate";
import { generateAnytimeChores } from "@/lib/chores/anytime";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { generatePoolChores } from "@/lib/chores/pool";
import { generateReadingTasks } from "@/lib/bible/generate";

/**
 * The `/api/v1/dashboard` payload: the same "my day" the web personal view
 * (src/app/person/[id]/page.tsx) shows on a phone, reduced to a serializable
 * shape for the native client. Every derivation here — the row mapping, the
 * completion percent, the per-category bars, the grouping — mirrors that page so
 * the two clients agree. Scoring rules live on the server (school excluded from
 * the percent and bars, etc.); the client only renders what it's handed.
 *
 * Deliberately phase 1: chores/reading/exercise/school/etc. as a grouped
 * checklist with per-category bars. Workout prompts appear but aren't tappable
 * (they need the multi-step logger, a later increment); the shared-dashboard
 * extras (claimable pool, schedule, reminders, companion, progression) are also
 * later phases.
 */

// Same order the personal page reads the day in.
const ORDER: Category[] = [
  Category.CHORE,
  Category.BIBLE,
  Category.EXERCISE,
  Category.SCHOOL,
  Category.WORK,
  Category.APPOINTMENT,
  Category.OTHER,
];

export type ApiTask = {
  id: string;
  title: string;
  category: Category;
  status: string;
  dueDate: string;
  subtitle: string | null;
  isOverdue: boolean;
  stale: boolean;
  /** Generated from a chore — a parent removes it from the Chores page. */
  locked: boolean;
  /** A workout prompt: shown, but completed via the workout logger, not a tap. */
  isWorkout: boolean;
  /** Whether the client may complete/uncomplete it with a tap. */
  completable: boolean;
  test: { score: number | null; scoreMax: number } | null;
};

export type ApiCategoryBar = {
  category: Category;
  label: string;
  total: number;
  complete: number;
  overdue: number;
  percent: number;
};

export type ApiDashboard = {
  date: string;
  percent: number | null;
  categories: ApiCategoryBar[];
  overdue: ApiTask[];
  groups: { category: Category; label: string; items: ApiTask[] }[];
};

/**
 * Self-heal today's tasks the way the personal page does, so a phone opening
 * before the wall tablet still sees a full day. Only ever runs for `today`.
 */
async function ensureGenerated(dayISO: string, today: string): Promise<void> {
  if (dayISO !== today) return;
  await generateChores(today);
  await generateWorkoutTasks(today);
  await generatePoolChores(today);
  await generateReadingTasks(today);
  await generateAnytimeChores(today);
}

export async function loadApiDashboard(
  userId: string,
  dayISO: string,
  today: string,
): Promise<ApiDashboard> {
  await ensureGenerated(dayISO, today);

  const [tasks, workoutNames] = await Promise.all([
    loadPersonDay(userId, dayISO),
    loadWorkoutPlanNames(userId),
  ]);

  const rows: ApiTask[] = tasks.map((t) => {
    const dueISO = fromDateColumn(t.dueDate);
    const isWorkout =
      t.category === Category.EXERCISE &&
      (t.generatedFrom ?? "").startsWith("workout:");
    const title = isWorkout
      ? (workoutNames.get(dayOfWeek(dueISO)) ?? t.title)
      : t.title;

    const sw = t.schoolWork;
    const subtitle =
      t.category === Category.SCHOOL && sw
        ? [
            sw.class?.name ?? sw.subject,
            SCHOOL_TYPE_LABEL[sw.type],
            `due ${formatShort(dueISO)}`,
          ]
            .filter(Boolean)
            .join(" · ")
        : null;

    const isOverdue =
      (t.lateAfter ? today > fromDateColumn(t.lateAfter) : dueISO < today) &&
      t.status === TaskStatus.PENDING &&
      !t.stale;

    return {
      id: t.id,
      title,
      category: t.category,
      status: t.status as string,
      dueDate: dueISO,
      subtitle,
      isOverdue,
      stale: t.stale,
      locked: Boolean(t.choreId),
      isWorkout,
      completable: !isWorkout && !t.stale,
      test:
        t.category === Category.SCHOOL && sw?.type === "TEST"
          ? { score: sw.score ?? null, scoreMax: sw.scoreMax ?? 100 }
          : null,
    };
  });

  // Overall percent and per-category bars: school excluded, skipped/stale
  // excluded — identical to the personal page's header and bars.
  const counted = rows.filter(
    (r) => r.status !== "SKIPPED" && !r.stale && r.category !== Category.SCHOOL,
  );
  const done = counted.filter((r) => r.status === "COMPLETE").length;
  const percent = counted.length
    ? Math.round((done / counted.length) * 100)
    : null;

  const categories: ApiCategoryBar[] = ORDER.map((category) => {
    const items = rows.filter(
      (r) =>
        r.category === category &&
        r.status !== "SKIPPED" &&
        !r.stale &&
        r.category !== Category.SCHOOL,
    );
    const total = items.length;
    const complete = items.filter((r) => r.status === "COMPLETE").length;
    const overdue = items.filter((r) => r.isOverdue).length;
    return {
      category,
      label: CATEGORY_LABELS[category],
      total,
      complete,
      overdue,
      percent: total ? Math.round((complete / total) * 100) : 0,
    };
  }).filter((c) => c.total > 0);

  const overdue = rows.filter((r) => r.isOverdue);
  const todayRows = rows.filter((r) => !r.isOverdue && !r.stale);

  const groups = ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: todayRows.filter((r) => r.category === category),
  })).filter((g) => g.items.length > 0);

  return { date: dayISO, percent, categories, overdue, groups };
}
