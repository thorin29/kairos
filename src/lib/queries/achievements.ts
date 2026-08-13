import "server-only";
import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  addMonths,
  fromDateColumn,
  startOfMonth,
  startOfWeek,
  toDateColumn,
  todayISO,
} from "@/lib/dates";
import { isStale, loadStaleContext, type StaleInput } from "@/lib/chores/stale";
import { loadStandings, rankStandings } from "@/lib/queries/standings";
import { getScoringStart } from "@/lib/settings";
import {
  computeStreaks,
  earnedMilestones,
  type DayClass,
} from "@/lib/scoring/streaks";

export type PersonAchievements = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  currentStreak: number;
  longestStreak: number;
  /** Streak thresholds reached (7 / 30 / 100). */
  milestones: number[];
  perfectWeeks: number;
  perfectMonths: number;
  monthlyWins: number;
};

/** How many completed months back to crown winners for. */
const MONTH_LOOKBACK = 24;

/**
 * Everything the badges shelf needs, derived entirely from raw completion
 * history — never the scoring window. That's deliberate: a reset moves the
 * scoreboard's start but leaves what actually happened intact, so streaks,
 * perfect weeks and past crowns all survive it.
 *
 * ...except the fresh-start line does apply: a reset moves it to today, and
 * from that point streaks, perfect weeks/months and past crowns all start
 * over — so a testing period can be wiped along with the scores it produced.
 */
export async function loadAchievements(): Promise<PersonAchievements[]> {
  const today = todayISO();
  const thisMonth = startOfMonth(today);
  const startISO = await getScoringStart();
  const dueFloor = startISO ? { gte: toDateColumn(startISO) } : {};

  const [people, tasks, ctx] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true,
      },
    }),
    prisma.task.findMany({
      where: { dueDate: { lte: toDateColumn(today), ...dueFloor } },
      select: {
        userId: true,
        category: true,
        choreId: true,
        status: true,
        dueDate: true,
        isOpen: true,
      },
    }),
    loadStaleContext(today),
  ]);

  // Group each person's own, still-owned tasks by day, by ISO week, and by
  // month. Released (open) and skipped (excused) rows are set aside.
  type DayBucket = { assigned: number; complete: number; missed: number };
  const perPerson = new Map<
    string,
    {
      days: Map<string, DayBucket>;
      weeks: Map<string, { assigned: number; complete: number }>;
      months: Map<string, { assigned: number; complete: number }>;
    }
  >();

  const seed = (userId: string) => {
    let p = perPerson.get(userId);
    if (!p) {
      p = { days: new Map(), weeks: new Map(), months: new Map() };
      perPerson.set(userId, p);
    }
    return p;
  };

  for (const t of tasks) {
    if (t.isOpen || t.status === TaskStatus.SKIPPED) continue;
    const p = seed(t.userId);
    const dayISO = fromDateColumn(t.dueDate);
    const weekISO = startOfWeek(dayISO);
    const monthISO = dayISO.slice(0, 7);

    const day = p.days.get(dayISO) ?? { assigned: 0, complete: 0, missed: 0 };
    day.assigned += 1;
    const complete = t.status === TaskStatus.COMPLETE;
    if (complete) day.complete += 1;
    else if (isStale(t as StaleInput, today, ctx)) day.missed += 1;
    p.days.set(dayISO, day);

    const wk = p.weeks.get(weekISO) ?? { assigned: 0, complete: 0 };
    wk.assigned += 1;
    if (complete) wk.complete += 1;
    p.weeks.set(weekISO, wk);

    const mo = p.months.get(monthISO) ?? { assigned: 0, complete: 0 };
    mo.assigned += 1;
    if (complete) mo.complete += 1;
    p.months.set(monthISO, mo);
  }

  // Crown each completed month from raw standings, so past trophies persist
  // through a reset. Bounded to a sane lookback.
  const monthWins = await tallyMonthlyWins(thisMonth);

  return people.map((person) => {
    const name = person.displayName ?? person.name;
    const p = perPerson.get(person.id);

    // Classify each task-day; gaps between them are neutral and bridge, so we
    // only need the days that had work.
    const dayClasses: DayClass[] = p
      ? [...p.days.entries()]
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([, b]): DayClass => {
            if (b.missed > 0) return "miss";
            if (b.complete === b.assigned) return "clean";
            return "neutral"; // still catchable, not yet a miss
          })
      : [];
    const { current, longest } = computeStreaks(dayClasses);

    const perfectWeeks = p
      ? [...p.weeks.entries()].filter(
          ([wkISO, b]) =>
            b.assigned > 0 &&
            b.complete === b.assigned &&
            addDays(wkISO, 6) < today, // week fully in the past
        ).length
      : 0;

    const perfectMonths = p
      ? [...p.months.entries()].filter(
          ([moISO, b]) =>
            b.assigned > 0 && b.complete === b.assigned && moISO < thisMonth.slice(0, 7),
        ).length
      : 0;

    return {
      id: person.id,
      name,
      color: person.color,
      avatarPath: person.avatarPath,
      currentStreak: current,
      longestStreak: longest,
      milestones: earnedMilestones(longest),
      perfectWeeks,
      perfectMonths,
      monthlyWins: monthWins.get(person.id) ?? 0,
    };
  });
}

/**
 * Just the streak for one person, without the month-by-month crown queries —
 * cheap enough to run on their own page as a bit of encouragement.
 */
export async function loadPersonStreak(
  userId: string,
): Promise<{ current: number; longest: number }> {
  const today = todayISO();
  const startISO = await getScoringStart();
  const dueFloor = startISO ? { gte: toDateColumn(startISO) } : {};
  const [tasks, ctx] = await Promise.all([
    prisma.task.findMany({
      where: { userId, dueDate: { lte: toDateColumn(today), ...dueFloor } },
      select: {
        userId: true,
        category: true,
        choreId: true,
        status: true,
        dueDate: true,
        isOpen: true,
      },
    }),
    loadStaleContext(today),
  ]);

  const days = new Map<string, { assigned: number; complete: number; missed: number }>();
  for (const t of tasks) {
    if (t.isOpen || t.status === TaskStatus.SKIPPED) continue;
    const dayISO = fromDateColumn(t.dueDate);
    const d = days.get(dayISO) ?? { assigned: 0, complete: 0, missed: 0 };
    d.assigned += 1;
    if (t.status === TaskStatus.COMPLETE) d.complete += 1;
    else if (isStale(t as StaleInput, today, ctx)) d.missed += 1;
    days.set(dayISO, d);
  }

  const classes: DayClass[] = [...days.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, b]): DayClass => {
      if (b.missed > 0) return "miss";
      if (b.complete === b.assigned) return "clean";
      return "neutral";
    });

  return computeStreaks(classes);
}

/** Winners (co-winners on a tie) of every completed month within the lookback,
 *  tallied per person. Reads raw standings so a reset doesn't erase a crown. */
async function tallyMonthlyWins(
  thisMonth: string,
): Promise<Map<string, number>> {
  const wins = new Map<string, number>();
  for (let i = 1; i <= MONTH_LOOKBACK; i++) {
    const monthStart = addMonths(thisMonth, -i);
    const monthEnd = addDays(addMonths(monthStart, 1), -1);
    const ranked = rankStandings(
      await loadStandings(monthStart, monthEnd),
    );
    const top = ranked.find((s) => s.percent != null);
    if (!top || top.percent == null) continue;
    for (const s of ranked) {
      if (s.percent === top.percent) {
        wins.set(s.id, (wins.get(s.id) ?? 0) + 1);
      }
    }
  }
  return wins;
}
