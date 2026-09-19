import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn, weekDays } from "@/lib/dates";

/** One person's involvement in a single up-for-grabs (pool) chore. */
export type PoolParticipant = {
  name: string;
  color: string;
  /** Times completed inside the rolling window (default 90 days). */
  count: number;
  /** Most recent completion ever (YYYY-MM-DD), or null if this person has never
   *  done the chore. Someone who's drifted off keeps a stale date rather than
   *  vanishing. */
  lastDoneISO: string | null;
};

/**
 * Per-person participation for each scheduled (non-always-open) pool chore.
 *
 * The list for a chore holds everyone who has EVER completed it — never a fixed
 * roster and never people who haven't done it — ordered most-recent first, so
 * whoever hasn't pitched in for the longest sinks to the bottom. `count` is
 * scoped to the rolling window; `lastDoneISO` is all-time. Completions are
 * `Task` rows (status COMPLETE) against a pool chore, so no schema change is
 * needed to read this.
 */
export async function loadPoolParticipation(
  windowDays = 90,
): Promise<Map<string, PoolParticipant[]>> {
  // The shared chores whose roster we show, and who each is available for.
  const chores = await prisma.chore.findMany({
    where: { isActive: true, isPool: true, alwaysOpen: false, perpetual: false },
    select: { id: true, poolEligibility: { select: { userId: true } } },
  });
  if (chores.length === 0) return new Map();

  // Everyone who could be on a roster — the "available to everyone" default, and
  // needed to render people who've never done a chore.
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, displayName: true, color: true },
    orderBy: { sortOrder: "asc" },
  });
  const userById = new Map(users.map((u) => [u.id, u] as const));
  const allUserIds = users.map((u) => u.id);

  const rows = await prisma.task.findMany({
    where: { status: "COMPLETE", choreId: { in: chores.map((c) => c.id) } },
    select: { choreId: true, userId: true, completedAt: true, dueDate: true },
  });

  const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  // choreId -> userId -> { window count, all-time last-done ms }
  const stats = new Map<string, Map<string, { count: number; lastMs: number }>>();
  for (const r of rows) {
    if (!r.choreId || !r.userId) continue;
    // completedAt is the real event time; fall back to the due date for any
    // older row that predates completedAt being recorded.
    const ms = (r.completedAt ?? r.dueDate).getTime();
    const perUser = stats.get(r.choreId) ?? new Map();
    const cur = perUser.get(r.userId) ?? { count: 0, lastMs: 0 };
    if (ms >= cutoffMs) cur.count += 1; // window-scoped count
    if (ms > cur.lastMs) cur.lastMs = ms; // all-time last-done
    perUser.set(r.userId, cur);
    stats.set(r.choreId, perUser);
  }

  const out = new Map<string, PoolParticipant[]>();
  for (const c of chores) {
    // No eligibility rows means the chore is available to everyone.
    const eligibleIds = c.poolEligibility.length
      ? c.poolEligibility.map((e) => e.userId)
      : allUserIds;
    const perUser = stats.get(c.id);

    const people = eligibleIds
      .map((uid) => {
        const u = userById.get(uid);
        if (!u) return null; // an inactive/removed person left on a roster
        const s = perUser?.get(uid);
        return {
          name: u.displayName ?? u.name,
          color: u.color,
          count: s?.count ?? 0,
          lastDoneISO:
            s && s.lastMs > 0 ? new Date(s.lastMs).toISOString().slice(0, 10) : null,
        };
      })
      .filter((p): p is PoolParticipant => p !== null)
      // Most recent at the top; never-done (null) sinks to the bottom.
      .sort((a, b) => {
        if (a.lastDoneISO === b.lastDoneISO) return 0;
        if (a.lastDoneISO === null) return 1;
        if (b.lastDoneISO === null) return -1;
        return a.lastDoneISO < b.lastDoneISO ? 1 : -1;
      });

    out.set(c.id, people);
  }
  return out;
}

export type AlwaysOpenWeekly = {
  id: string;
  title: string;
  icon: string | null;
  /** Who has done this always-open chore this week, most first. */
  people: { name: string; color: string; count: number }[];
};

/**
 * Per-chore weekly participation for always-open chores. Always-open "Done"
 * taps are recorded as COMPLETE `Task` rows (see completeAlwaysOpenChoreCore),
 * so this counts those for the current week — NOT `ChoreLog`, which nothing
 * writes. Only chores done at least once this week are returned, so the section
 * empties itself each week.
 */
export async function loadAlwaysOpenWeekly(
  todayISO: string,
): Promise<AlwaysOpenWeekly[]> {
  const chores = await prisma.chore.findMany({
    where: { alwaysOpen: true },
    orderBy: { title: "asc" },
    select: { id: true, title: true, icon: true },
  });
  if (chores.length === 0) return [];

  const days = weekDays(todayISO);
  const tasks = await prisma.task.findMany({
    where: {
      status: "COMPLETE",
      choreId: { in: chores.map((c) => c.id) },
      dueDate: { gte: toDateColumn(days[0]), lte: toDateColumn(days[6]) },
    },
    select: {
      choreId: true,
      user: { select: { id: true, name: true, displayName: true, color: true } },
    },
  });

  const byChore = new Map<
    string,
    Map<string, { name: string; color: string; count: number }>
  >();
  for (const t of tasks) {
    if (!t.choreId) continue;
    const per = byChore.get(t.choreId) ?? new Map();
    const name = t.user.displayName ?? t.user.name;
    const cur = per.get(t.user.id) ?? { name, color: t.user.color, count: 0 };
    cur.count += 1;
    per.set(t.user.id, cur);
    byChore.set(t.choreId, per);
  }

  const out: AlwaysOpenWeekly[] = [];
  for (const c of chores) {
    const per = byChore.get(c.id);
    if (!per) continue; // only chores actually done this week
    out.push({
      id: c.id,
      title: c.title,
      icon: c.icon,
      people: [...per.values()].sort((a, b) => b.count - a.count),
    });
  }
  return out;
}
