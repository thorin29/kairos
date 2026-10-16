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
  icon: string | null;
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
  icon: string | null;
  intervalDays: number;
  isPaused: boolean;
  nextDueISO: string | null;
  outstanding: boolean;
  claimedByName: string | null;
  alwaysOpen: boolean;
  cooldownMinutes: number;
  effort: number;
  effortLocked: boolean;
  /** People this shared chore is available for; empty means everyone. */
  eligibleUserIds: string[];
  /** People still in the pool but never flagged "your turn" for it. */
  reminderOptOutIds: string[];
};

// Named row shapes: without a generated Prisma client these queries type as
// `any` locally, so the fields read below are spelled out (and hand-checked
// against schema.prisma) rather than inferred.
type PoolChoreDbRow = {
  id: string;
  title: string;
  icon: string | null;
  intervalDays: number | null;
  isPaused: boolean;
  alwaysOpen: boolean;
  cooldownMinutes: number;
  effort: number;
  effortLocked: boolean;
  tasks: {
    status: string;
    isOpen: boolean;
    completedAt: Date | null;
    dueDate: Date;
    user: { name: string; displayName: string | null };
  }[];
  poolEligibility: { userId: string }[];
  poolReminderOptOuts: { userId: string }[];
};

type AlwaysOpenDbRow = {
  id: string;
  title: string;
  effort: number;
  cooldownMinutes: number;
  tasks: {
    completedAt: Date | null;
    user: { id: string; name: string; displayName: string | null; color: string };
  }[];
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
      poolEligibility: { select: { userId: true } },
      poolReminderOptOuts: { select: { userId: true } },
    },
  });

  return (chores as PoolChoreDbRow[]).map((c) => {
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
      icon: c.icon,
      intervalDays: interval,
      isPaused: c.isPaused,
      nextDueISO,
      outstanding,
      claimedByName,
      alwaysOpen: c.alwaysOpen,
      cooldownMinutes: c.cooldownMinutes,
      effort: c.effort,
      effortLocked: c.effortLocked,
      eligibleUserIds: c.poolEligibility.map((e) => e.userId),
      reminderOptOutIds: c.poolReminderOptOuts.map((o) => o.userId),
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
      icon: c.icon,
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

/** One completion behind a tally count: the chore and the day it was done. */
export type SharedTallyItem = { title: string; dateISO: string };

export type SharedTallyRow = {
  name: string;
  color: string;
  count: number;
  /** Exactly the completions `count` counts, newest first (v0.584). */
  items: SharedTallyItem[];
};

/** Who has completed shared (pool) chores, by count — for the chores page.
 *  Counts since the current scoring start so it matches the season, and
 *  carries the rows behind each count so the page can list them. The date is
 *  the household day it was actually done (completedAt), falling back to the
 *  due date for rows that predate completedAt. */
export async function loadSharedChoreTally(): Promise<SharedTallyRow[]> {
  const { getScoringStart } = await import("@/lib/settings");
  const { toDateColumn, fromDateColumn, localParts } = await import("@/lib/dates");
  const start = await getScoringStart();
  const rows = await prisma.task.findMany({
    where: {
      status: "COMPLETE",
      chore: { is: { isPool: true } },
      ...(start ? { dueDate: { gte: toDateColumn(start) } } : {}),
    },
    select: {
      title: true,
      completedAt: true,
      dueDate: true,
      user: { select: { name: true, displayName: true, color: true } },
    },
  });
  type Row = {
    title: string;
    completedAt: Date | null;
    dueDate: Date;
    user: { name: string; displayName: string | null; color: string };
  };
  const counts = new Map<string, { color: string; items: SharedTallyItem[] }>();
  for (const r of rows as Row[]) {
    const name = r.user.displayName ?? r.user.name;
    const cur = counts.get(name) ?? { color: r.user.color, items: [] };
    cur.items.push({
      title: r.title,
      dateISO: r.completedAt ? localParts(r.completedAt).iso : fromDateColumn(r.dueDate),
    });
    counts.set(name, cur);
  }
  return [...counts.entries()]
    .map(([name, v]) => ({
      name,
      color: v.color,
      count: v.items.length,
      items: v.items.sort((a, b) =>
        a.dateISO === b.dateISO ? a.title.localeCompare(b.title) : a.dateISO < b.dateISO ? 1 : -1,
      ),
    }))
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
 *
 * With `viewerId`, only the chores available to that person ("Available for"
 * in admin; none configured = everyone). Without it, all of them.
 */
export async function loadAlwaysOpenChores(
  dayISO: string,
  viewerId?: string,
): Promise<AlwaysOpenChore[]> {
  const { toDateColumn } = await import("@/lib/dates");
  const { loadPoolEligibility, isAvailableTo } = await import("@/lib/chores/pool-eligibility");
  const all: AlwaysOpenDbRow[] = await prisma.chore.findMany({
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
  const eligibility = viewerId
    ? await loadPoolEligibility(all.map((c) => c.id))
    : null;
  const chores = eligibility
    ? all.filter((c) => isAvailableTo(eligibility, c.id, viewerId as string))
    : all;

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

/** Icons to show after the Chores summary line: for a person on a day, one entry
 *  per distinct chore-icon completed (dueToday + COMPLETE), counted so always-open
 *  chores done N times read as \u00d7N. Chores with no icon are ignored. */
export async function loadChoreBadges(
  userId: string,
  dayISO: string,
): Promise<import("@/lib/chore-icons").ChoreBadge[]> {
  const { toDateColumn } = await import("@/lib/dates");
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: "COMPLETE",
      dueDate: toDateColumn(dayISO),
      chore: { icon: { not: null } },
    },
    select: { chore: { select: { icon: true } } },
  });
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const icon = t.chore?.icon;
    if (!icon) continue;
    counts.set(icon, (counts.get(icon) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([icon, count]) => ({ icon, count }))
    .sort((a, b) => a.icon.localeCompare(b.icon));
}
