import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";
import { MAX_TASK_INTERVAL, TASK_FREQS, occursOn as occursOnRule } from "@/lib/tasks/recur-rule";

const HORIZON_DAYS = 30;
/** How far past the window to look for a series' next occurrence. */
const NEXT_DAYS = 1100;

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
  notifyMinutes: number | null;
};

/** Whether a template lands on a given calendar day (ignoring the end rule). */
function occursOn(t: Template, iso: string): boolean {
  return occursOnRule({ freq: t.freq, interval: t.interval, byday: t.byday, startISO: fromDateColumn(t.startDate) }, iso);
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
  while (iso <= windowTo && guard++ < 40000) {
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
      notifyMinutes: number | null;
    }
  >();

  for (const t of templates) {
    const gf = `rtask:${t.id}`;
    const dates = occurrenceDates(t, fromISO, toISO);
    // Nothing due in the window (every 90 days, yearly, or a first due date
    // months out): keep the next one anyway, so the series is on the task
    // list (v0.669). Up to about three years ahead.
    if (dates.length === 0) {
      const next = occurrenceDates(t, addDays(toISO, 1), addDays(toISO, NEXT_DAYS))[0];
      if (next) dates.push(next);
    }
    for (const iso of dates) {
      expected.set(`${gf}|${iso}`, {
        userId: t.userId,
        category: t.category as Category,
        title: t.title,
        notes: t.notes,
        weight: t.weight,
        dueDate: toDateColumn(iso),
        generatedFrom: gf,
        createdById: t.createdById,
        notifyMinutes: t.notifyMinutes,
      });
    }
  }

  // From the window on, with no end: a next occurrence kept past the window
  // must be seen, or it would be made again on every run.
  const existing = await prisma.task.findMany({
    where: {
      generatedFrom: { startsWith: "rtask:" },
      dueDate: { gte: toDateColumn(fromISO) },
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

  // Keep recurring history light: retain only the most recent completed
  // occurrences per template, pruning older completed ones. Runs alongside the
  // usual reconcile so history doesn't grow without bound.
  const COMPLETED_KEEP = 2;
  const history = await prisma.task.findMany({
    where: { generatedFrom: { startsWith: "rtask:" }, status: TaskStatus.COMPLETE },
    select: { id: true, generatedFrom: true },
    orderBy: [{ dueDate: "desc" }, { completedAt: "desc" }],
  });
  const kept = new Map<string, number>();
  const stale: string[] = [];
  for (const t of history) {
    const gf = t.generatedFrom ?? "";
    const n = (kept.get(gf) ?? 0) + 1;
    kept.set(gf, n);
    if (n > COMPLETED_KEEP) stale.push(t.id);
  }
  let pruned = 0;
  if (stale.length > 0) {
    pruned = (
      await prisma.task.deleteMany({ where: { id: { in: stale } } })
    ).count;
  }

  return { created, removed: removed + pruned };
}

const FREQS: readonly string[] = TASK_FREQS;
const ENDS = ["NEVER", "COUNT", "UNTIL"];

export type RecurringInput = {
  userId: string;
  clientId?: string | null;
  title: string;
  freq: string;
  interval: number;
  byday: string[];
  startDate: string;
  endMode: string;
  maxCount: number | null;
  until: string;
  createdById?: string | null;
  notifyMinutes?: number | null;
};

/**
 * Validate and create one recurring-task template, then materialize its
 * near-term occurrences. Shared by the admin form and the device task-add
 * endpoint so both enforce the same rules.
 */
type NormalizedRecurring = {
  userId: string;
  title: string;
  freq: string;
  interval: number;
  byday: string | null;
  startDate: Date;
  endMode: string;
  maxCount: number | null;
  untilDate: Date | null;
  notifyMinutes: number | null;
};

/** Validate + normalize a recurring input into the row shape (minus createdById). */
function normalizeRecurring(
  input: RecurringInput,
): { error: string } | { error: null; data: NormalizedRecurring } {
  const title = input.title.trim().slice(0, 120);
  const interval = Math.max(1, Math.min(MAX_TASK_INTERVAL, Math.round(input.interval) || 1));
  const byday = input.byday.map((d) => d.trim().toUpperCase()).filter(Boolean);
  const freq = FREQS.includes(input.freq) ? input.freq : "WEEKLY";
  const endMode = ENDS.includes(input.endMode) ? input.endMode : "NEVER";
  const maxCount = Math.round(Number(input.maxCount ?? 0)) || null;

  if (!input.userId) return { error: "Pick who it's for." };
  if (title.length < 2) return { error: "Give the task a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return { error: "Pick a start date." };
  }
  // Weekly with no weekdays picked lands on the first due date's weekday.
  if (endMode === "COUNT" && (!maxCount || maxCount < 1)) {
    return { error: "Say how many times." };
  }
  if (endMode === "UNTIL" && !/^\d{4}-\d{2}-\d{2}$/.test(input.until)) {
    return { error: "Pick an end date." };
  }
  return {
    error: null,
    data: {
      userId: input.userId,
      title,
      freq,
      interval,
      byday: freq === "WEEKLY" && byday.length > 0 ? byday.join(",") : null,
      startDate: toDateColumn(input.startDate),
      endMode,
      maxCount: endMode === "COUNT" ? maxCount : null,
      untilDate: endMode === "UNTIL" ? toDateColumn(input.until) : null,
      notifyMinutes: input.notifyMinutes ?? null,
    },
  };
}

export async function createRecurringTask(
  input: RecurringInput,
): Promise<{ error: string | null }> {
  const n = normalizeRecurring(input);
  if (n.error !== null) return { error: n.error };
  // Idempotency: a retried offline create whose response was lost must not
  // create a second series. Recognized by clientId; we deliberately do NOT
  // return the template id as a task id (SyncManager would mistake it for a
  // Task real-id), so both original and retry return { error: null }.
  const clientId = (input.clientId ?? "").trim() || null;
  if (clientId) {
    const existing = await prisma.recurringTask.findFirst({ where: { userId: input.userId, clientId } });
    if (existing) return { error: null };
  }
  await prisma.recurringTask.create({
    data: { ...n.data, createdById: input.createdById ?? null, clientId },
  });
  await generateRecurringTasks();
  return { error: null };
}

/**
 * Edit a recurring series in place, keeping its id so completed occurrences are
 * preserved (the generator's last-2-completed prune trims history). Pending
 * occurrences are dropped and re-materialized against the new schedule.
 */
export async function updateRecurringTaskInPlace(
  rid: string,
  input: RecurringInput,
): Promise<{ error: string | null }> {
  const n = normalizeRecurring(input);
  if (n.error !== null) return { error: n.error };
  await prisma.task.deleteMany({
    where: { generatedFrom: `rtask:${rid}`, status: TaskStatus.PENDING },
  });
  await prisma.recurringTask.update({ where: { id: rid }, data: n.data });
  await generateRecurringTasks();
  return { error: null };
}
