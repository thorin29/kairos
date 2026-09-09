import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  dayOfWeek,
  daysBetween,
  fromDateColumn,
  toDateColumn,
  todayISO,
} from "@/lib/dates";

const HORIZON_DAYS = 30;
const DOW = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

type Template = {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  category: string;
  weight: number | null;
  freq: string;
  interval: number;
  byday: string | null;
  startDate: Date;
  endMode: string;
  maxCount: number | null;
  untilDate: Date | null;
  createdById: string | null;
};

/** Whether a template lands on a given calendar day (ignoring the end rule). */
function occursOn(t: Template, iso: string): boolean {
  const startISO = fromDateColumn(t.startDate);
  if (iso < startISO) return false;
  const interval = Math.max(1, t.interval || 1);

  if (t.freq === "DAILY") {
    return daysBetween(startISO, iso) % interval === 0;
  }

  if (t.freq === "WEEKLY") {
    const codes = (t.byday || "")
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length > 0) {
      if (!codes.includes(DOW[dayOfWeek(iso)])) return false;
    } else if (dayOfWeek(iso) !== dayOfWeek(startISO)) {
      return false;
    }
    if (interval === 1) return true;
    // Every N-th week, aligned to the start's week (Sunday-based).
    const startWeek = addDays(startISO, -dayOfWeek(startISO));
    const thisWeek = addDays(iso, -dayOfWeek(iso));
    return Math.floor(daysBetween(startWeek, thisWeek) / 7) % interval === 0;
  }

  if (t.freq === "MONTHLY") {
    const [sy, sm, sd] = startISO.split("-").map(Number);
    const [y, m, d] = iso.split("-").map(Number);
    if (d !== sd) return false;
    const months = (y - sy) * 12 + (m - sm);
    return months >= 0 && months % interval === 0;
  }

  return false;
}

/** The occurrence dates inside [windowFrom, windowTo], honoring the end rule. */
function occurrenceDates(
  t: Template,
  windowFrom: string,
  windowTo: string,
): string[] {
  const startISO = fromDateColumn(t.startDate);
  const untilISO = t.untilDate ? fromDateColumn(t.untilDate) : null;
  const counting = t.endMode === "COUNT" && !!t.maxCount;

  const out: string[] = [];
  // COUNT must be counted from the start; otherwise we can begin at the window.
  let iso = counting
    ? startISO
    : startISO > windowFrom
      ? startISO
      : windowFrom;
  let n = 0;
  let guard = 0;
  while (iso <= windowTo && guard++ < 4000) {
    if (untilISO && iso > untilISO) break;
    if (occursOn(t, iso)) {
      n++;
      if (counting && n > (t.maxCount as number)) break;
      if (iso >= windowFrom) out.push(iso);
    }
    iso = addDays(iso, 1);
  }
  return out;
}

/**
 * Materializes Task rows from active recurring-task templates for a window,
 * reconciling like the chore generator: create the missing days, remove any
 * unfinished ones that no longer match (template edited/deactivated), and never
 * touch completed tasks or history.
 */
export async function generateRecurringTasks(
  fromISO: string = todayISO(),
  days: number = HORIZON_DAYS,
): Promise<{ created: number; removed: number }> {
  const toISO = addDays(fromISO, days - 1);

  const templates = (await prisma.recurringTask.findMany({
    where: { active: true },
  })) as unknown as Template[];

  const expected = new Map<
    string,
    {
      userId: string;
      category: Category;
      title: string;
      notes: string | null;
      weight: number | null;
      dueDate: Date;
      generatedFrom: string;
      createdById: string | null;
    }
  >();

  for (const t of templates) {
    const gf = `rtask:${t.id}`;
    for (const iso of occurrenceDates(t, fromISO, toISO)) {
      expected.set(`${gf}|${iso}`, {
        userId: t.userId,
        category: t.category as Category,
        title: t.title,
        notes: t.notes,
        weight: t.weight,
        dueDate: toDateColumn(iso),
        generatedFrom: gf,
        createdById: t.createdById,
      });
    }
  }

  const existing = await prisma.task.findMany({
    where: {
      generatedFrom: { startsWith: "rtask:" },
      dueDate: { gte: toDateColumn(fromISO), lte: toDateColumn(toISO) },
    },
    select: { id: true, generatedFrom: true, dueDate: true, status: true },
  });

  const present = new Set<string>();
  const orphaned: string[] = [];
  for (const t of existing) {
    const key = `${t.generatedFrom}|${fromDateColumn(t.dueDate)}`;
    present.add(key);
    if (!expected.has(key) && t.status === "PENDING") orphaned.push(t.id);
  }

  let removed = 0;
  if (orphaned.length > 0) {
    removed = (
      await prisma.task.deleteMany({ where: { id: { in: orphaned } } })
    ).count;
  }

  const missing = [...expected.entries()]
    .filter(([key]) => !present.has(key))
    .map(([, row]) => row);
  let created = 0;
  if (missing.length > 0) {
    created = (
      await prisma.task.createMany({ data: missing, skipDuplicates: true })
    ).count;
  }

  return { created, removed };
}
