import "server-only";
import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";
import { loadPausedDates } from "@/lib/queries/pauses";

/**
 * Shared chores run on a completion cycle rather than a weekly slot.
 *
 * One instance exists at a time. It sits open until somebody claims and
 * finishes it, and the next appears intervalDays after that completion — so
 * a lawn mown early comes round early, and one left late slips later.
 * That's the whole point of separating these from weekday assignments.
 *
 * Paused chores produce nothing. Resuming puts one out the same day.
 */
export async function generatePoolChores(
  dayISO: string = todayISO(),
): Promise<number> {
  const chores = await prisma.chore.findMany({
    where: { isActive: true, isPool: true, isPaused: false, perpetual: false, alwaysOpen: false },
  });

  // Always-open chores are tap-to-complete now, not scheduled instances.
  // Clear any pending ones the old model may have left on the board.
  await prisma.task.deleteMany({
    where: { status: { not: TaskStatus.COMPLETE }, chore: { alwaysOpen: true } },
  });

  if (chores.length === 0) return 0;

  // Household pauses (vacations) suppress shared chores too. Clear any pending
  // instance that lands on a paused day so it leaves the card, and defer the
  // next one until the break is over (below). A break covering "now" also
  // stops a fresh one going out today.
  const pausedDates = await loadPausedDates(
    addDays(dayISO, -60),
    addDays(dayISO, 30),
  );
  if (pausedDates.size > 0) {
    const poolIds = chores.map((c) => c.id);
    const pending = await prisma.task.findMany({
      where: {
        choreId: { in: poolIds },
        status: { not: TaskStatus.COMPLETE },
      },
      select: { id: true, dueDate: true },
    });
    const drop = pending
      .filter((t) => pausedDates.has(fromDateColumn(t.dueDate)))
      .map((t) => t.id);
    if (drop.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: drop } } });
    }
  }

  // Unclaimed instances need an owner because a task row always has one.
  // Parking them on an admin keeps the schema simple; isOpen is what
  // actually means "nobody has this", and open tasks count for no one.
  const holder = await prisma.user.findFirst({
    where: { isActive: true, role: "ADMIN" },
    orderBy: { sortOrder: "asc" },
  });
  if (!holder) return 0;

  let created = 0;

  for (const chore of chores) {
    const latest = await prisma.task.findFirst({
      where: { choreId: chore.id },
      orderBy: { dueDate: "desc" },
    });

    // Something is already out there, done or not. Nothing to schedule.
    if (latest && latest.status !== TaskStatus.COMPLETE) continue;

    let dueISO: string;

    if (!latest) {
      dueISO = dayISO;
    } else if (chore.alwaysOpen) {
      // Perpetual: a fresh instance is available the moment the last is done.
      dueISO = dayISO;
    } else {
      const interval = chore.intervalDays ?? 7;
      const finishedOn = latest.completedAt
        ? fromDateColumn(
            new Date(
              Date.UTC(
                latest.completedAt.getUTCFullYear(),
                latest.completedAt.getUTCMonth(),
                latest.completedAt.getUTCDate(),
              ),
            ),
          )
        : fromDateColumn(latest.dueDate);

      dueISO = addDays(finishedOn, interval);

      // Not due yet.
      if (dueISO > dayISO) continue;
    }

    // A break defers the next instance until the day after it ends, so a
    // shared chore never comes due mid-vacation.
    while (pausedDates.has(dueISO)) dueISO = addDays(dueISO, 1);
    if (dueISO > dayISO) continue;

    await prisma.task.create({
      data: {
        userId: holder.id,
        choreId: chore.id,
        title: chore.title,
        category: Category.CHORE,
        dueDate: toDateColumn(dueISO),
        sortOrder: chore.sortOrder,
        isOpen: true,
      },
    });

    created += 1;
  }

  return created;
}
