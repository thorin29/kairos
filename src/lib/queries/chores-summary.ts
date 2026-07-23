import { prisma } from "@/lib/prisma";

export type AssignmentRow = {
  id: string;
  dayOfWeek: number;
  userId: string;
  userName: string;
  userColor: string;
};

export type ChoreSummary = {
  id: string;
  title: string;
  assignments: AssignmentRow[];
  /** Gaps in days between consecutive occurrences, wrapping the week. */
  gaps: number[];
  unassigned: boolean;
};

/**
 * Because expiry is by succession, the gap between occurrences is exactly
 * how long an unfinished instance stays live. A chore assigned only on
 * Monday gives seven days to catch up; Monday and Wednesday gives two and
 * five. Surfacing the gaps makes that visible before it surprises anyone.
 */
export type PoolChoreRow = {
  id: string;
  title: string;
  intervalDays: number;
  isPaused: boolean;
  nextDueISO: string | null;
  outstanding: boolean;
};

/** Shared chores, with where each one currently stands. */
export async function loadPoolChores(): Promise<PoolChoreRow[]> {
  const chores = await prisma.chore.findMany({
    where: { isActive: true, isPool: true },
    orderBy: { title: "asc" },
    include: {
      tasks: { orderBy: { dueDate: "desc" }, take: 1 },
    },
  });

  return chores.map((c) => {
    const latest = c.tasks[0];
    const interval = c.intervalDays ?? 7;
    const outstanding = Boolean(latest && latest.status !== "COMPLETE");

    let nextDueISO: string | null = null;
    if (latest && latest.status === "COMPLETE") {
      const from = latest.completedAt ?? latest.dueDate;
      const d = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
      );
      d.setUTCDate(d.getUTCDate() + interval);
      nextDueISO = d.toISOString().slice(0, 10);
    }

    return {
      id: c.id,
      title: c.title,
      intervalDays: interval,
      isPaused: c.isPaused,
      nextDueISO,
      outstanding,
    };
  });
}

export async function loadChoreSummary(): Promise<ChoreSummary[]> {
  const chores = await prisma.chore.findMany({
    where: { isActive: true, isPool: false },
    // Alphabetical everywhere: the master list, the assign dropdown, and the
    // catch-up table all read from this, and a stable predictable order
    // beats insertion order once there are more than a handful.
    orderBy: { title: "asc" },
    include: {
      assignments: {
        where: { isActive: true },
        include: { user: { select: { id: true, name: true, color: true } } },
      },
    },
  });

  return chores.map((c) => {
    const assignments = c.assignments
      .map((a) => ({
        id: a.id,
        dayOfWeek: a.dayOfWeek,
        userId: a.userId,
        userName: a.user.name,
        userColor: a.user.color,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    const days = assignments.map((a) => a.dayOfWeek);
    const gaps: number[] = [];
    for (let i = 0; i < days.length; i++) {
      const next = days[(i + 1) % days.length];
      const gap =
        days.length === 1 ? 7 : (next - days[i] + 7) % 7 || 7;
      gaps.push(gap);
    }

    return {
      id: c.id,
      title: c.title,
      assignments,
      gaps,
      unassigned: assignments.length === 0,
    };
  });
}
