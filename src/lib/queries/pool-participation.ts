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

export type AlwaysOpenTallyRow = { name: string; color: string; count: number };

/**
 * This week's per-person tally across all always-open chores — a simple running
 * count of who's been doing them. Always-open taps write `ChoreLog` rows, so
 * this counts those for the current week; it empties out on its own each week.
 */
export async function loadAlwaysOpenTally(
  todayISO: string,
): Promise<AlwaysOpenTallyRow[]> {
  const chores = await prisma.chore.findMany({
    where: { alwaysOpen: true },
    select: { id: true },
  });
  if (chores.length === 0) return [];

  const days = weekDays(todayISO);
  const logs = await prisma.choreLog.findMany({
    where: {
      choreId: { in: chores.map((c) => c.id) },
      day: { gte: toDateColumn(days[0]), lte: toDateColumn(days[6]) },
    },
    select: { user: { select: { id: true, name: true, displayName: true, color: true } } },
  });

  const counts = new Map<string, { name: string; color: string; count: number }>();
  for (const l of logs) {
    const name = l.user.displayName ?? l.user.name;
    const cur = counts.get(l.user.id) ?? { name, color: l.user.color, count: 0 };
    cur.count += 1;
    counts.set(l.user.id, cur);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}
