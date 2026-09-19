import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn, weekDays } from "@/lib/dates";

/** One person's involvement in a single up-for-grabs (pool) chore. */
export type PoolParticipant = {
  name: string;
  color: string;
  /** Times completed inside the rolling window (default 90 days). */
  count: number;
  /** Most recent completion ever (YYYY-MM-DD), so someone who has drifted off
   *  still shows with a stale date rather than vanishing. */
  lastDoneISO: string;
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
  const rows = await prisma.task.findMany({
    where: {
      status: "COMPLETE",
      chore: { is: { isPool: true, alwaysOpen: false, perpetual: false } },
    },
    select: {
      choreId: true,
      completedAt: true,
      dueDate: true,
      user: { select: { id: true, name: true, displayName: true, color: true } },
    },
  });

  const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  // choreId -> userId -> accumulator
  const byChore = new Map<
    string,
    Map<string, { name: string; color: string; count: number; lastMs: number }>
  >();

  for (const r of rows) {
    if (!r.choreId) continue;
    // completedAt is the real event time; fall back to the due date for any
    // older row that predates completedAt being recorded.
    const when = r.completedAt ?? r.dueDate;
    const ms = when.getTime();
    const perUser = byChore.get(r.choreId) ?? new Map();
    const name = r.user.displayName ?? r.user.name;
    const cur = perUser.get(r.user.id) ?? {
      name,
      color: r.user.color,
      count: 0,
      lastMs: 0,
    };
    if (ms >= cutoffMs) cur.count += 1; // window-scoped count
    if (ms > cur.lastMs) cur.lastMs = ms; // all-time last-done
    perUser.set(r.user.id, cur);
    byChore.set(r.choreId, perUser);
  }

  const out = new Map<string, PoolParticipant[]>();
  for (const [choreId, perUser] of byChore) {
    const people = [...perUser.values()]
      .map((v) => ({
        name: v.name,
        color: v.color,
        count: v.count,
        lastDoneISO: new Date(v.lastMs).toISOString().slice(0, 10),
      }))
      // Most recent at the top; longest-ago at the bottom.
      .sort((a, b) => (a.lastDoneISO < b.lastDoneISO ? 1 : a.lastDoneISO > b.lastDoneISO ? -1 : 0));
    out.set(choreId, people);
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
