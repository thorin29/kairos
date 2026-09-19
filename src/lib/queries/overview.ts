import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn } from "@/lib/dates";
import { isStale, loadStaleContext } from "@/lib/chores/stale";
import {
  loadActivePause,
  PAUSABLE_CATEGORIES,
} from "@/lib/queries/pauses";

export type CategorySummary = {
  category: Category;
  total: number;
  complete: number;
  overdue: number;
  /** null when nothing is assigned — renders neutral, not failing. */
  percent: number | null;
};

export type PersonSummary = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
  role: string;
  categories: CategorySummary[];
  total: number;
  complete: number;
  overdue: number;
  percent: number | null;
  /** Name of the active household pause, when one covers today. */
  paused: string | null;
};

/**
 * A day's tasks are everything due that day plus anything still pending
 * from an earlier day. Overdue work is never rewritten to a new date, so
 * the original due date survives for reporting.
 */
export async function loadDay(dayISO: string): Promise<PersonSummary[]> {
  const day = toDateColumn(dayISO);
  const stale = await loadStaleContext(dayISO);
  const activePause = await loadActivePause(dayISO);
  const pausedName = activePause?.name ?? null;

  const [people, allTasks] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.task.findMany({
      where: {
        OR: [
          { dueDate: day },
          { dueDate: { lt: day }, status: TaskStatus.PENDING },
          // Window school work shows from its start date until it's done.
          {
            category: Category.SCHOOL,
            status: TaskStatus.PENDING,
            schoolWork: { dateSpecific: false, startDate: { lte: day } },
          },
        ],
      },
      select: {
        userId: true,
        category: true,
        status: true,
        dueDate: true,
        lateAfter: true,
        choreId: true,
        isOpen: true,
      },
    }),
  ]);

  // Expired chores are no longer actionable, so they drop out of today's
  // numbers entirely rather than dragging the percentage down forever. The
  // rows survive against their original due date for weekly reporting.
  // Released chores belong to nobody right now, so they sit out of everyone's
  // score until someone claims them.
  const tasks = allTasks.filter(
    (t) => !t.isOpen && !isStale(t, dayISO, stale),
  );

  // While a household pause is on, scheduled work (chores, reading, workouts)
  // steps aside for everyone — including anything already overdue — so the day
  // reads clean. Hand-added tasks and appointments still stand.
  const visible = pausedName
    ? tasks.filter((t) => !PAUSABLE_CATEGORIES.includes(t.category))
    : tasks;

  return people.map((person) => {
    const mine = visible.filter((t) => t.userId === person.id);

    const categories = Object.values(Category).map((category) => {
      const inCat = mine.filter((t) => t.category === category);
      // Skipped tasks are excused: out of both numerator and denominator.
      const counted = inCat.filter((t) => t.status !== TaskStatus.SKIPPED);
      const complete = counted.filter(
        (t) => t.status === TaskStatus.COMPLETE,
      ).length;
      const overdue = counted.filter(
        (t) =>
          t.status === TaskStatus.PENDING &&
          (t.lateAfter ? day > t.lateAfter : t.dueDate < day),
      ).length;

      return {
        category,
        total: counted.length,
        complete,
        overdue,
        percent: counted.length
          ? Math.round((complete / counted.length) * 100)
          : null,
      };
    });

    // School now counts toward the score (the scoring rework turned it on).
    // With no school work assigned it simply contributes nothing.
    const scored = categories;
    const total = scored.reduce((n, c) => n + c.total, 0);
    const complete = scored.reduce((n, c) => n + c.complete, 0);
    const overdue = scored.reduce((n, c) => n + c.overdue, 0);

    return {
      id: person.id,
      name: person.displayName ?? person.name,
      color: person.color,
      avatarPath: person.avatarPath,
      avatarPosition: person.avatarPosition,
      role: person.role,
      categories: categories
        .filter((c) => c.total > 0)
        .sort((a, b) => {
          // Bible, Chores, School, Workouts, then the rest — matches the app.
          const order = ["BIBLE", "CHORE", "SCHOOL", "EXERCISE", "WORK", "APPOINTMENT", "OTHER"];
          const ai = order.indexOf(String(a.category));
          const bi = order.indexOf(String(b.category));
          return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        }),
      total,
      complete,
      overdue,
      percent: total ? Math.round((complete / total) * 100) : null,
      paused: pausedName,
    };
  });
}

export type OpenTask = {
  id: string;
  title: string;
  category: string;
  dueDateISO: string;
  isOverdue: boolean;
  releasedByName: string;
  /** Shared chores were never anyone's, so they read differently. */
  isShared: boolean;
  /** For shared (pool) chores only: the viewing user's OWN most recent
   *  completion day, plus the chore's cadence, so the client can show "you last
   *  did this Nd ago" and flag it stale. Uses the real completion time
   *  (completedAt) to match the chores-page table — never the scheduled due
   *  date. null / 0 otherwise (or when the viewer has never done it). */
  lastDoneISO: string | null;
  intervalDays: number;
  /** For shared (pool) chores: true when the viewing user is the eligible person
   *  who last did this chore furthest in the past — never-done counts as
   *  furthest. Drives the "your turn" badge. false otherwise. */
  furthestBehind: boolean;
};

/** Chores handed back to the household and waiting for someone to claim.
 *  Pass `userId` to scope shared chores to who they're available for, to include
 *  that person's own last-done, and to flag when it's most their turn. */
export async function loadOpenTasks(
  dayISO: string,
  userId?: string,
): Promise<OpenTask[]> {
  const stale = await loadStaleContext(dayISO);
  const activePause = await loadActivePause(dayISO);
  const day = toDateColumn(dayISO);

  const rows = await prisma.task.findMany({
    where: {
      isOpen: true,
      status: TaskStatus.PENDING,
      dueDate: { lte: day },
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
    include: {
      user: { select: { name: true, displayName: true } },
      chore: { select: { isPool: true, intervalDays: true, alwaysOpen: true } },
    },
  });

  const visible = rows
    .filter((t) => !t.chore?.alwaysOpen)
    .filter((t) => !isStale(t, dayISO, stale))
    .filter((t) => !(activePause && PAUSABLE_CATEGORIES.includes(t.category)));

  const poolChoreIds = [
    ...new Set(
      visible
        .filter((t) => t.chore?.isPool && t.choreId)
        .map((t) => t.choreId as string),
    ),
  ];

  // For shared chores: who each is available for, everyone's last-done, and from
  // those the viewer's own last-done (for "you last did this Nd ago") plus
  // whether the viewer is furthest behind (for the "your turn" badge). Chores the
  // viewer isn't eligible for drop out entirely. completedAt is the real event
  // time, matching the chores-page table; dueDate is only a legacy fallback.
  const dropChoreIds = new Set<string>();
  const furthestChoreIds = new Set<string>();
  const lastIsoByChore = new Map<string, string>();

  if (poolChoreIds.length > 0) {
    const [elig, done, activeUsers] = await Promise.all([
      prisma.poolEligibility.findMany({
        where: { choreId: { in: poolChoreIds } },
        select: { choreId: true, userId: true },
      }),
      prisma.task.findMany({
        where: { choreId: { in: poolChoreIds }, status: TaskStatus.COMPLETE },
        select: { choreId: true, userId: true, completedAt: true, dueDate: true },
      }),
      prisma.user.findMany({ where: { isActive: true }, select: { id: true } }),
    ]);

    const allActiveIds = activeUsers.map((u) => u.id);
    const eligibleByChore = new Map<string, Set<string>>();
    for (const e of elig) {
      const set = eligibleByChore.get(e.choreId) ?? new Set<string>();
      set.add(e.userId);
      eligibleByChore.set(e.choreId, set);
    }
    // choreId -> userId -> most recent completion ms
    const lastMs = new Map<string, Map<string, number>>();
    for (const d of done) {
      if (!d.choreId || !d.userId) continue;
      const per = lastMs.get(d.choreId) ?? new Map<string, number>();
      const ms = (d.completedAt ?? d.dueDate).getTime();
      const cur = per.get(d.userId);
      if (cur === undefined || ms > cur) per.set(d.userId, ms);
      lastMs.set(d.choreId, per);
    }

    if (userId) {
      const now = Date.now();
      for (const cid of poolChoreIds) {
        const configured = eligibleByChore.get(cid);
        const eligibleIds =
          configured && configured.size > 0 ? [...configured] : allActiveIds;

        // Not available to this person — hide the chore from their card.
        if (!eligibleIds.includes(userId)) {
          dropChoreIds.add(cid);
          continue;
        }

        const per = lastMs.get(cid);
        const viewerMs = per?.get(userId);
        if (viewerMs !== undefined) {
          lastIsoByChore.set(cid, new Date(viewerMs).toISOString().slice(0, 10));
        }

        // Days-behind; never-done is furthest (Infinity). Ties all count.
        const behind = (uid: string) => {
          const ms = per?.get(uid);
          return ms === undefined ? Infinity : now - ms;
        };
        const viewerBehind = behind(userId);
        let maxBehind = 0;
        for (const uid of eligibleIds) {
          const b = behind(uid);
          if (b > maxBehind) maxBehind = b;
        }
        if (viewerBehind >= maxBehind) furthestChoreIds.add(cid);
      }
    }
  }

  return visible
    .filter((t) => !(t.chore?.isPool && dropChoreIds.has(t.choreId ?? "")))
    .map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category as string,
    dueDateISO: fromDateColumn(t.dueDate),
    isOverdue: fromDateColumn(t.dueDate) < dayISO,
    releasedByName: t.user.displayName ?? t.user.name,
    isShared: Boolean(t.chore?.isPool),
    lastDoneISO: t.chore?.isPool ? (lastIsoByChore.get(t.choreId ?? "") ?? null) : null,
    intervalDays: t.chore?.intervalDays ?? 0,
    furthestBehind: t.chore?.isPool ? furthestChoreIds.has(t.choreId ?? "") : false,
  }));
}

/** Full task rows for one person on one day, overdue items first. */
export async function loadPersonDay(userId: string, dayISO: string) {
  const day = toDateColumn(dayISO);
  const stale = await loadStaleContext(dayISO);
  const activePause = await loadActivePause(dayISO);

  const rows = await prisma.task.findMany({
    where: {
      userId,
      isOpen: false,
      OR: [
        { dueDate: day },
        { dueDate: { lt: day }, status: TaskStatus.PENDING },
        {
          category: Category.SCHOOL,
          status: TaskStatus.PENDING,
          schoolWork: { dateSpecific: false, startDate: { lte: day } },
        },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      schoolWork: {
        select: {
          type: true,
          subject: true,
          dateSpecific: true,
          score: true,
          scoreMax: true,
          class: { select: { name: true } },
        },
      },
    },
  });

  const visible = activePause
    ? rows.filter((t) => !PAUSABLE_CATEGORIES.includes(t.category))
    : rows;

  return visible.map((t) => ({ ...t, stale: isStale(t, dayISO, stale) }));
}
