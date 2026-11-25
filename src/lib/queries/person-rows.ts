import "server-only";
import { fromDateColumn, formatShort } from "@/lib/dates";
import { SCHOOL_TYPE_LABEL } from "@/lib/school";
import type { CATEGORY_LABELS } from "@/lib/colors";
import type { loadPersonDay } from "@/lib/queries/overview";

type DayTask = Awaited<ReturnType<typeof loadPersonDay>>[number];

export type PersonRow = {
  id: string;
  title: string;
  category: keyof typeof CATEGORY_LABELS;
  status: string;
  dueDateISO: string;
  subtitle?: string;
  isOverdue: boolean;
  stale: boolean;
  originalDueISO: string | null;
  locked: boolean;
  isWorkout: boolean;
  test?: { score: number | null; scoreMax: number };
};

/**
 * A person's day as rows (shared by the home page and the area pages, v0.800).
 * School rows read subject-first, with the lesson, type and due date under it;
 * a workout prompt takes its name from `workoutTitle` when given.
 */
export function personRows(
  tasks: readonly DayTask[],
  today: string,
  workoutTitle?: (dueISO: string) => string | undefined,
): PersonRow[] {
  return tasks.map((t) => {
    const dueISO = fromDateColumn(t.dueDate);
    const isWorkout = t.category === "EXERCISE" && (t.generatedFrom ?? "").startsWith("workout:");
    const title = isWorkout ? (workoutTitle?.(dueISO) ?? t.title) : t.title;
    const sw = t.schoolWork;
    const schoolSubject = sw ? (sw.class?.name ?? sw.subject) : null;
    // Where it was first scheduled, when that's not where it sits now, and
    // which way it moved.
    const originalISO = t.originalDueDate ? fromDateColumn(t.originalDueDate) : null;
    const moved =
      originalISO && originalISO !== dueISO
        ? dueISO < originalISO
          ? `ahead of ${formatShort(originalISO)}`
          : `moved from ${formatShort(originalISO)}`
        : null;
    const subtitle =
      t.category === "SCHOOL" && sw
        ? [t.title, SCHOOL_TYPE_LABEL[sw.type], `due ${formatShort(dueISO)}`, moved].filter(Boolean).join(" · ")
        : undefined;
    return {
      id: t.id,
      title: t.category === "SCHOOL" && schoolSubject ? schoolSubject : title,
      category: t.category as keyof typeof CATEGORY_LABELS,
      status: t.status as string,
      dueDateISO: dueISO,
      subtitle,
      isOverdue: (t.lateAfter ? today > fromDateColumn(t.lateAfter) : dueISO < today) && t.status === "PENDING" && !t.stale,
      stale: t.stale,
      originalDueISO: originalISO,
      locked: Boolean(t.choreId),
      isWorkout,
      test: t.category === "SCHOOL" && sw?.type === "TEST" ? { score: sw.score ?? null, scoreMax: sw.scoreMax ?? 100 } : undefined,
    };
  });
}

/** Late rows of these categories (oldest first) and today's. */
export function splitRows(rows: readonly PersonRow[], cats: readonly string[]): { late: PersonRow[]; today: PersonRow[] } {
  const mine = rows.filter((r) => cats.includes(r.category));
  return {
    late: mine.filter((r) => r.isOverdue).sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO)),
    today: mine.filter((r) => !r.isOverdue && !r.stale),
  };
}
