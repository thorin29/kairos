import "server-only";
import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";

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
    where: { isActive: true, isPool: true, isPaused: false },
  });

  if (chores.length === 0) return 0;

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
