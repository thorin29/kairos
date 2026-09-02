import { prisma } from "@/lib/prisma";
import { Category } from "@/generated/prisma/client";
import { weekDays, todayISO, toDateColumn, fromDateColumn } from "@/lib/dates";

export type AssignmentRow = {
  id: string;
  dayOfWeek: number;
  userId: string;
  userName: string;
  userColor: string;
  /** This week's instance is done. */
  complete: boolean;
  /** This week's instance was due earlier this week and isn't done. */
  pastDue: boolean;
};

export type ChoreSummary = {
  id: string;
  title: string;
  assignments: AssignmentRow[];
  /** Gaps in days between consecutive occurrences, wrapping the week. */
  gaps: number[];
  unassigned: boolean;
  isCollaborative: boolean;
  isAnytime: boolean;
  intervalWeeks: number;
  effort: number;
  effortLocked: boolean;
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
  claimedByName: string | null;
  alwaysOpen: boolean;
  cooldownMinutes: number;
  effort: number;
  effortLocked: boolean;
};

/** Shared chores, with where each one currently stands. */
export async function loadPoolChores(): Promise<PoolChoreRow[]> {
  const chores = await prisma.chore.findMany({
    where: { isActive: true, isPool: true, perpetual: false },
    orderBy: { title: "asc" },
    include: {
      tasks: {
        orderBy: { dueDate: "desc" },
        take: 1,
        include: { user: { select: { name: true, displayName: true } } },
      },
    },
  });

  return chores.map((c) => {
    const latest = c.tasks[0];
    const interval = c.intervalDays ?? 7;
    // Always-open chores are tap-to-complete, not scheduled — they have no
    // pending instance, claim, or next-due date to report.
    const pending = !c.alwaysOpen && Boolean(latest && latest.status !== "COMPLETE");
    // "Up for grabs" only if nobody has claimed it yet.
    const outstanding = pending && Boolean(latest?.isOpen);
    const claimedByName =
      pending && latest && !latest.isOpen
        ? (latest.user.displayName ?? latest.user.name)
        : null;

    let nextDueISO: string | null = null;
    if (!c.alwaysOpen && latest && latest.status === "COMPLETE") {
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
      claimedByName,
      alwaysOpen: c.alwaysOpen,
      cooldownMinutes: c.cooldownMinutes,
      effort: c.effort,
      effortLocked: c.effortLocked,
    };
  });
}

export async function loadChoreSummary(
  today: string = todayISO(),
): Promise<ChoreSummary[]> {
  const week = weekDays(today); // Sun..Sat, index === dayOfWeek
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

  // This week's generated chore instances, to show completion on the rotation.
  const weekTasks = await prisma.task.findMany({
    where: {
      category: Category.CHORE,
      choreId: { not: null },
      dueDate: { gte: toDateColumn(week[0]), lte: toDateColumn(week[6]) },
    },
    select: { choreId: true, userId: true, dueDate: true, status: true },
  });
  const statusByKey = new Map<string, string>();
  for (const t of weekTasks) {
    if (!t.choreId) continue;
    statusByKey.set(
      `${t.choreId}|${t.userId}|${fromDateColumn(t.dueDate)}`,
      t.status,
    );
  }

  return chores.map((c) => {
    const assignments = c.assignments
      .map((a) => {
        const dateISO = week[a.dayOfWeek] ?? null;
        const status = dateISO
          ? statusByKey.get(`${c.id}|${a.userId}|${dateISO}`)
          : undefined;
        const complete = status === "COMPLETE";
        const pastDue =
          status === "PENDING" && dateISO !== null && dateISO < today;
        return {
          id: a.id,
          dayOfWeek: a.dayOfWeek,
          userId: a.userId,
          userName: a.user.name,
          userColor: a.user.color,
          complete,
          pastDue,
        };
      })
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
      isCollaborative: c.isCollaborative,
      isAnytime: c.isAnytime,
      intervalWeeks: c.intervalWeeks,
      effort: c.effort,
      effortLocked: c.effortLocked,
    };
  });
}

export type SharedTallyRow = { name: string; color: string; count: number };

/** Who has completed shared (pool) chores, by count — for the chores page.
 *  Counts since the current scoring start so it matches the season. */
export async function loadSharedChoreTally(): Promise<SharedTallyRow[]> {
  const { getScoringStart } = await import("@/lib/settings");
  const { toDateColumn } = await import("@/lib/dates");
  const start = await getScoringStart();
  const rows = await prisma.task.findMany({
    where: {
      status: "COMPLETE",
      chore: { is: { isPool: true } },
      ...(start ? { dueDate: { gte: toDateColumn(start) } } : {}),
    },
    select: { user: { select: { name: true, displayName: true, color: true } } },
  });
  const counts = new Map<string, { color: string; count: number }>();
  for (const r of rows) {
    const name = r.user.displayName ?? r.user.name;
    const cur = counts.get(name) ?? { color: r.user.color, count: 0 };
    cur.count += 1;
    counts.set(name, cur);
  }
  return [...counts.entries()]
    .map(([name, v]) => ({ name, color: v.color, count: v.count }))
    .sort((a, b) => b.count - a.count);
}


export type AlwaysOpenChore = {
  id: string;
  title: string;
  effort: number;
  total: number; // times done today (across everyone)
  byUser: { id: string; name: string; color: string; count: number }[];
  cooldownMinutes: number;
  /** When it becomes tappable again (epoch ms), or null if available now. */
  readyAtMs: number | null;
};

/**
 * Always-open chores for the dashboard: each shows today's per-person tap
 * counts and, if a cooldown is set, when it's next available.
 */
export async function loadAlwaysOpenChores(
  dayISO: string,
): Promise<AlwaysOpenChore[]> {
  const { toDateColumn } = await import("@/lib/dates");
  const chores = await prisma.chore.findMany({
    where: { isActive: true, isPool: true, alwaysOpen: true, isPaused: false },
    orderBy: { title: "asc" },
    include: {
      tasks: {
        where: { dueDate: toDateColumn(dayISO), status: "COMPLETE" },
        include: {
          user: { select: { id: true, name: true, displayName: true, color: true } },
        },
      },
    },
  });

  const now = Date.now();
  return chores.map((c) => {
    const counts = new Map<string, { name: string; color: string; count: number }>();
    let lastMs = 0;
    for (const t of c.tasks) {
      const key = t.user.id;
      const cur = counts.get(key) ?? {
        name: t.user.displayName ?? t.user.name,
        color: t.user.color,
        count: 0,
      };
      cur.count += 1;
      counts.set(key, cur);
      if (t.completedAt) lastMs = Math.max(lastMs, t.completedAt.getTime());
    }
    let readyAtMs: number | null = null;
    if (c.cooldownMinutes > 0 && lastMs > 0) {
      const ready = lastMs + c.cooldownMinutes * 60_000;
      if (ready > now) readyAtMs = ready;
    }
    return {
      id: c.id,
      title: c.title,
      effort: c.effort,
      total: c.tasks.length,
      byUser: [...counts.entries()].map(([id, v]) => ({ id, ...v })),
      cooldownMinutes: c.cooldownMinutes,
      readyAtMs,
    };
  });
}
