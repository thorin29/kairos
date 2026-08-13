import "server-only";
import { prisma } from "@/lib/prisma";
import {
  startOfMonth,
  addMonths,
  addDays,
  formatMonth,
  toDateColumn,
  todayISO,
} from "@/lib/dates";
import { getBibleBonusCents, getBibleGraceDays } from "@/lib/settings";

// How many ended months back to keep offering rewards for. Old months rarely
// complete late, and it bounds the work done on every load.
const LOOKBACK_MONTHS = 6;

export type RewardUser = {
  id: string;
  name: string;
  enabled: boolean;
  baseCents: number;
};

export type RewardConfig = {
  users: RewardUser[];
  bonusCents: number;
  graceDays: number;
};

/** The reward settings shown in Admin → Money: the per-person opt-in and
 *  amount, plus the household bonus and grace period. */
export async function loadBibleRewardConfig(): Promise<RewardConfig> {
  const [users, bonusCents, graceDays] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        bibleRewardEnabled: true,
        bibleRewardCents: true,
      },
    }),
    getBibleBonusCents(),
    getBibleGraceDays(),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      enabled: u.bibleRewardEnabled,
      baseCents: u.bibleRewardCents,
    })),
    bonusCents,
    graceDays,
  };
}

function lastOfMonth(monthStartISO: string): string {
  return addDays(addMonths(monthStartISO, 1), -1);
}

type MonthDone = {
  completed: boolean;
  lastDoneISO: string | null;
  hadReading: boolean;
};

/**
 * For a set of users and one month, work out who finished it. A month is
 * finished when the person had at least one reading that month, none are still
 * pending, and at least one was actually completed (a wholly-skipped month
 * isn't an achievement). `lastDoneISO` is when the final reading was ticked —
 * used to test the grace window. Bible reading never pauses, so every reading
 * assigned that month counts; nothing is silently dropped.
 */
async function monthCompletion(
  userIds: string[],
  monthStartISO: string,
): Promise<Map<string, MonthDone>> {
  const nextMonth = addMonths(monthStartISO, 1);
  const tasks = await prisma.task.findMany({
    where: {
      userId: { in: userIds },
      category: "BIBLE",
      dueDate: { gte: toDateColumn(monthStartISO), lt: toDateColumn(nextMonth) },
    },
    select: { userId: true, status: true, completedAt: true },
  });

  const agg = new Map<
    string,
    { total: number; pending: number; complete: number; lastDone: string | null }
  >();
  for (const t of tasks) {
    const a =
      agg.get(t.userId) ??
      { total: 0, pending: 0, complete: 0, lastDone: null as string | null };
    a.total += 1;
    if (t.status === "PENDING") a.pending += 1;
    if (t.status === "COMPLETE") {
      a.complete += 1;
      if (t.completedAt) {
        const iso = t.completedAt.toISOString().slice(0, 10);
        if (!a.lastDone || iso > a.lastDone) a.lastDone = iso;
      }
    }
    agg.set(t.userId, a);
  }

  const out = new Map<string, MonthDone>();
  for (const id of userIds) {
    const a = agg.get(id);
    const hadReading = !!a && a.total > 0;
    const completed = hadReading && a.pending === 0 && a.complete > 0;
    out.set(id, { completed, lastDoneISO: a?.lastDone ?? null, hadReading });
  }
  return out;
}

export type RewardCompleter = {
  userId: string;
  name: string;
  baseCents: number;
  needsBase: boolean;
  needsBonus: boolean;
};

export type RewardMonth = {
  periodKey: string; // YYYY-MM
  monthStartISO: string;
  label: string;
  bonusAvailable: boolean;
  bonusCents: number;
  completers: RewardCompleter[];
};

/**
 * The outstanding Bible-reward action items, newest month first. Each entry is
 * a month with people who finished it but haven't been paid yet. When everyone
 * opted-in finished within the grace window, the month carries a bonus, and
 * the admin approves base + bonus for all in one go; otherwise it's per-person
 * base rewards. Only months with something left to do are returned.
 */
export async function pendingBibleRewards(
  today: string = todayISO(),
): Promise<{ months: RewardMonth[]; count: number }> {
  const optedIn = await prisma.user.findMany({
    where: { isActive: true, bibleRewardEnabled: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, bibleRewardCents: true },
  });
  if (optedIn.length === 0) return { months: [], count: 0 };

  const ids = optedIn.map((u) => u.id);
  const nameById = new Map<string, string>(
    optedIn.map((u) => [u.id, u.name] as [string, string]),
  );
  const baseById = new Map<string, number>(
    optedIn.map((u) => [u.id, u.bibleRewardCents] as [string, number]),
  );

  const bonusCents = await getBibleBonusCents();
  const graceDays = await getBibleGraceDays();

  const thisMonthStart = startOfMonth(today);
  // Ended months only: this month is still in progress, so start one back.
  const monthStarts: string[] = [];
  for (let i = 1; i <= LOOKBACK_MONTHS; i++) {
    monthStarts.push(addMonths(thisMonthStart, -i));
  }
  const periodKeys = monthStarts.map((m) => m.slice(0, 7));

  // Reward rows already posted for these people/months, so we never double-pay.
  const existing = await prisma.moneyEntry.findMany({
    where: {
      userId: { in: ids },
      kind: { in: ["BIBLE_REWARD", "BIBLE_BONUS"] },
      periodKey: { in: periodKeys },
    },
    select: { userId: true, kind: true, periodKey: true },
  });
  const hasBase = new Set<string>();
  const hasBonus = new Set<string>();
  for (const e of existing) {
    const key = `${e.userId}:${e.periodKey}`;
    if (e.kind === "BIBLE_REWARD") hasBase.add(key);
    else if (e.kind === "BIBLE_BONUS") hasBonus.add(key);
  }

  const months: RewardMonth[] = [];
  for (const monthStart of monthStarts) {
    const periodKey = monthStart.slice(0, 7);
    const done = await monthCompletion(ids, monthStart);

    const completerIds = ids.filter((id) => done.get(id)?.completed);
    if (completerIds.length === 0) continue;

    const graceDeadline = addDays(lastOfMonth(monthStart), graceDays);
    const latestDone = completerIds.reduce<string | null>((acc, id) => {
      const iso = done.get(id)?.lastDoneISO ?? null;
      if (iso && (!acc || iso > acc)) return iso;
      return acc;
    }, null);

    const allFinished = everyoneFinished(ids, done);
    const withinGrace =
      allFinished && !!latestDone && latestDone <= graceDeadline;
    const bonusAvailable = withinGrace && bonusCents > 0;

    const completers: RewardCompleter[] = completerIds.map((id) => {
      const key = `${id}:${periodKey}`;
      const baseCents = baseById.get(id) ?? 0;
      return {
        userId: id,
        name: nameById.get(id) ?? "",
        baseCents,
        needsBase: baseCents > 0 && !hasBase.has(key),
        needsBonus: bonusAvailable && !hasBonus.has(key),
      };
    });

    const actionable = completers.some((c) => c.needsBase || c.needsBonus);
    if (!actionable) continue;

    months.push({
      periodKey,
      monthStartISO: monthStart,
      label: formatMonth(monthStart),
      bonusAvailable,
      bonusCents,
      completers,
    });
  }

  return { months, count: months.length };
}

/**
 * True when every opted-in user who had reading that month finished it. Users
 * with no reading that month don't block the bonus (there was nothing for them
 * to finish).
 */
function everyoneFinished(
  userIds: string[],
  done: Map<string, MonthDone>,
): boolean {
  const readers = userIds.filter((id) => done.get(id)?.hadReading);
  if (readers.length === 0) return false;
  return readers.every((id) => done.get(id)?.completed);
}

/** Server-side re-check that a month is complete for a user before paying. */
export async function userFinishedMonth(
  userId: string,
  periodKey: string,
): Promise<boolean> {
  const monthStart = `${periodKey}-01`;
  const done = await monthCompletion([userId], monthStart);
  return !!done.get(userId)?.completed;
}

/** Whether the month's group bonus is genuinely available (re-checked at
 *  approval time). */
export async function monthBonusAvailable(periodKey: string): Promise<boolean> {
  const monthStart = `${periodKey}-01`;
  const optedIn = await prisma.user.findMany({
    where: { isActive: true, bibleRewardEnabled: true },
    select: { id: true },
  });
  const ids = optedIn.map((u) => u.id);
  if (ids.length === 0) return false;
  const done = await monthCompletion(ids, monthStart);
  const all = everyoneFinished(ids, done);
  if (!all) return false;
  const bonusCents = await getBibleBonusCents();
  if (bonusCents <= 0) return false;
  const graceDays = await getBibleGraceDays();
  const graceDeadline = addDays(lastOfMonth(monthStart), graceDays);
  const latestDone = ids.reduce<string | null>((acc, id) => {
    const iso = done.get(id)?.lastDoneISO ?? null;
    if (iso && (!acc || iso > acc)) return iso;
    return acc;
  }, null);
  return !!latestDone && latestDone <= graceDeadline;
}

export function monthEndDate(periodKey: string): Date {
  return toDateColumn(lastOfMonth(`${periodKey}-01`));
}
