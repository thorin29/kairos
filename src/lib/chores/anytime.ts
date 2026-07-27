import { Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";

// Periods are anchored to a fixed Monday so every "do anytime" assignment of
// the same chore lines up on the same period boundaries (which keeps the
// succession/expiry logic correct), and every period starts on a Monday.
const EPOCH_MONDAY_MS = Date.parse("2024-01-01T00:00:00Z"); // a Monday
const DAY_MS = 86_400_000;

function periodFor(todayISO: string, intervalWeeks: number): {
  startISO: string;
  lateAfterISO: string;
} {
  const n = Math.max(1, Math.floor(intervalWeeks || 1));
  const weeks = Math.floor(
    (Date.parse(`${todayISO}T00:00:00Z`) - EPOCH_MONDAY_MS) / (7 * DAY_MS),
  );
  const periodIndex = Math.floor(weeks / n);
  const startMs = EPOCH_MONDAY_MS + periodIndex * n * 7 * DAY_MS;
  const startISO = new Date(startMs).toISOString().slice(0, 10);
  // Monday + 7n days = next period's Monday; minus 2 days = the Saturday that
  // ends this period. Late only after that day.
  const lateAfterISO = new Date(startMs + (n * 7 - 2) * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return { startISO, lateAfterISO };
}

/**
 * Ensures each "do anytime" assignment has a task for the period containing
 * today: due on the period's Monday (so it shows all period) and marked late
 * only after the period's final Saturday. Older periods' instances expire on
 * their own through the succession rule, so nothing needs deleting here.
 */
export async function generateAnytimeChores(
  fromISO: string = todayISO(),
): Promise<{ created: number }> {
  const assignments = await prisma.choreAssignment.findMany({
    where: {
      isActive: true,
      chore: { isActive: true, isAnytime: true },
    },
    include: {
      chore: { select: { title: true, sortOrder: true, intervalWeeks: true } },
    },
  });

  const rows = [] as {
    userId: string;
    choreId: string;
    title: string;
    category: Category;
    dueDate: Date;
    lateAfter: Date;
    sortOrder: number;
    generatedFrom: string;
  }[];

  for (const a of assignments) {
    if (fromDateColumn(a.effectiveFrom) > fromISO) continue;
    if (a.effectiveTo && fromDateColumn(a.effectiveTo) < fromISO) continue;

    const { startISO, lateAfterISO } = periodFor(fromISO, a.chore.intervalWeeks);
    // Don't back-date before the assignment began.
    const dueISO =
      fromDateColumn(a.effectiveFrom) > startISO
        ? fromDateColumn(a.effectiveFrom)
        : startISO;

    rows.push({
      userId: a.userId,
      choreId: a.choreId,
      title: a.chore.title,
      category: Category.CHORE,
      dueDate: toDateColumn(dueISO),
      lateAfter: toDateColumn(lateAfterISO),
      sortOrder: a.chore.sortOrder,
      generatedFrom: a.id,
    });
  }

  if (rows.length === 0) return { created: 0 };

  // The (choreId, userId, dueDate) unique constraint makes this idempotent:
  // re-running never duplicates the current period's task.
  const result = await prisma.task.createMany({ data: rows, skipDuplicates: true });
  return { created: result.count };
}
