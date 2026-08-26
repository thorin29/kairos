import "server-only";
import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fromDateColumn,
  startOfWeek,
  addDays,
  toDateColumn,
  todayISO,
} from "@/lib/dates";
import { getScoringStart } from "@/lib/settings";
import { currentSeasonWindow } from "@/lib/season";
import { blendPalette, eggCostFor, stageForTenure, EGGS_PER_SEASON_CAP } from "@/lib/companions";
import { taskEffort, groupForCategory } from "@/lib/scoring/weights";
import { readingXpForBook, bibleXpForChapters } from "@/lib/scoring/reading";
import { loadBonuses } from "@/lib/queries/bonus";
import { isStale, loadStaleContext, type StaleInput } from "@/lib/chores/stale";
import { computeStreaks, earnedMilestones, type DayClass } from "@/lib/scoring/streaks";
import {
  XP_PER_EFFORT,
  TEST_SCORE_BONUS_XP,
  levelFromXp,
  seasonTier,
  masteryRank,
  computeBaseline,
  signatureOf,
  classFromSignature,
  STAT_ORDER,
  STAT_META,
  type LevelState,
  type SeasonState,
  type StatKey,
} from "@/lib/scoring/progression";

export type StatProgress = {
  key: StatKey;
  label: string;
  level: number;
  pct: number;
};

export type MasteryTitle = { title: string; chore: string; count: number };

export type PersonProgress = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
  className: string;
  level: LevelState;
  stats: StatProgress[];
  season: SeasonState;
  currentStreak: number;
  longestStreak: number;
  milestones: number[];
  perfectWeeks: number;
  bestWeekPct: number | null;
  masteries: MasteryTitle[];
  /** The companion display: an incubating egg, or the active creature. Colour
   *  is the skill-blend fingerprint on the card frame either way. */
  companionColor: string;
  companion: {
    active: boolean;
    species: string | null;
    stage: number;
    shiny: boolean;
    incubationPct: number;
    eggReady: boolean;
  };
  /** Proportional XP by domain, for the pixel XP bar (sums to ~1, or all 0). */
  statShares: Record<StatKey, number>;
  /** All-time XP, for the hatch action. */
  lifetimeXp: number;
};

const EPOCH = "2000-01-01";

/**
 * Everyone's character sheet: level and XP, per-category stats and the class
 * they fall into, this month's season tier, streaks, personal bests and a few
 * mastery titles. Pass a userId to compute just one person's.
 *
 * All of it counts from the scoring-start line, so a hard reset starts the
 * whole RPG over; a plain month rollover only refills the season tier.
 */
export async function loadProgression(): Promise<PersonProgress[]> {
  const today = todayISO();
  const seasonWin = await currentSeasonWindow(today);
  const seasonStart = seasonWin.startISO;
  const startISO = await getScoringStart();
  const dueFloor = startISO ? { gte: toDateColumn(startISO) } : {};

  const [people, tasks, ctx, seasonBonus, lifetimeBonus, compStates, activeComps, books, chapterReads] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true, color: true, avatarPath: true },
    }),
    prisma.task.findMany({
      where: {
        isOpen: false,
        status: { not: TaskStatus.SKIPPED },
        dueDate: { lte: toDateColumn(today), ...dueFloor },
      },
      select: {
        userId: true,
        category: true,
        status: true,
        weight: true,
        choreId: true,
        title: true,
        dueDate: true,
        chore: { select: { effort: true } },
        schoolWork: { select: { type: true, score: true, scoreMax: true } },
      },
    }),
    loadStaleContext(today),
    loadBonuses(seasonStart, today),
    loadBonuses(startISO ?? EPOCH, today),
    prisma.companionState.findMany(),
    prisma.companion.findMany({ where: { isActive: true } }),
    // Leisure reading feeds Scholar slightly (derived from the logs at read time).
    prisma.book.findMany({
      select: {
        userId: true,
        unit: true,
        length: true,
        logs: { select: { amount: true } },
      },
    }),
    // Personal Bible reading feeds Wisdom slightly (one row per chapter read).
    prisma.userChapterRead.findMany({ select: { userId: true } }),
  ]);

  type StateRow = {
    userId: string;
    incubationBaseXp: number;
    eggsHatched: number;
    seasonKey: string | null;
    eggsThisSeason: number;
  };
  type ActiveRow = { userId: string; species: string; shiny: boolean; activeSinceXp: number };
  const stateByUser = new Map(
    (compStates as StateRow[]).map((s) => [s.userId, s]),
  );
  const activeByUser = new Map(
    (activeComps as ActiveRow[]).map((c) => [c.userId, c]),
  );

  type Acc = {
    xp: number;
    statXp: Record<StatKey, number>;
    days: Map<string, { assigned: number; complete: number; missed: number }>;
    weeks: Map<string, { assigned: number; complete: number }>;
    month: { assigned: number; complete: number };
    mastery: Map<string, { chore: string; count: number }>;
  };
  const acc = new Map<string, Acc>();
  const seed = (id: string): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = {
        xp: 0,
        statXp: { CHORE: 0, EXERCISE: 0, BIBLE: 0, SCHOOL: 0, TASK: 0 },
        days: new Map(),
        weeks: new Map(),
        month: { assigned: 0, complete: 0 },
        mastery: new Map(),
      };
      acc.set(id, a);
    }
    return a;
  };
  for (const p of people) seed(p.id);

  for (const t of tasks) {
    const a = acc.get(t.userId);
    if (!a) continue; // task for an inactive user
    const effort = taskEffort({
      choreEffort: t.chore?.effort ?? null,
      taskWeight: t.weight,
    });
    const complete = t.status === TaskStatus.COMPLETE;
    const dayISO = fromDateColumn(t.dueDate);
    const weekISO = startOfWeek(dayISO);
    const stat = groupForCategory(t.category) as StatKey;

    if (complete) {
      a.xp += effort * XP_PER_EFFORT;
      a.statXp[stat] += effort * XP_PER_EFFORT;
      // A scored test lifts Scholar in proportion to how well it went.
      const sw = t.schoolWork;
      if (sw?.type === "TEST" && sw.score != null && sw.scoreMax) {
        const bonus = Math.round((sw.score / sw.scoreMax) * TEST_SCORE_BONUS_XP);
        a.xp += bonus;
        a.statXp[stat] += bonus;
      }
      if (t.choreId) {
        const m = a.mastery.get(t.choreId) ?? { chore: t.title, count: 0 };
        m.count += 1;
        a.mastery.set(t.choreId, m);
      }
    }

    const day = a.days.get(dayISO) ?? { assigned: 0, complete: 0, missed: 0 };
    day.assigned += 1;
    if (complete) day.complete += 1;
    else if (isStale(t as StaleInput, today, ctx)) day.missed += 1;
    a.days.set(dayISO, day);

    const wk = a.weeks.get(weekISO) ?? { assigned: 0, complete: 0 };
    wk.assigned += effort;
    if (complete) wk.complete += effort;
    a.weeks.set(weekISO, wk);

    if (dayISO >= seasonStart) {
      a.month.assigned += effort;
      if (complete) a.month.complete += effort;
    }
  }

  // Leisure reading lifts Scholar a little: normalize each book's pages/chapters
  // read, cap at its length, scale gently. Added before the baseline so it flows
  // into the per-stat level, the character level, and the signature just like a
  // completed task would.
  for (const b of books as {
    userId: string;
    unit: "PAGES" | "CHAPTERS";
    length: number;
    logs: { amount: number }[];
  }[]) {
    const a = acc.get(b.userId);
    if (!a) continue;
    const totalRead = b.logs.reduce((n, l) => n + l.amount, 0);
    const xp = readingXpForBook(b.unit, b.length, totalRead);
    a.xp += xp;
    a.statXp.SCHOOL += xp;
  }

  // Personal Bible reading lifts Wisdom a little, one row per chapter read.
  const chaptersByUser = new Map<string, number>();
  for (const r of chapterReads as { userId: string }[]) {
    chaptersByUser.set(r.userId, (chaptersByUser.get(r.userId) ?? 0) + 1);
  }
  for (const [userId, count] of chaptersByUser) {
    const a = acc.get(userId);
    if (!a) continue;
    const xp = bibleXpForChapters(count);
    a.xp += xp;
    a.statXp.BIBLE += xp;
  }

  // The family baseline per stat, so class and colour reflect what each person
  // does *above* the shared norm — universal work cancels out.
  const baseline = computeBaseline(people.map((p) => acc.get(p.id)!.statXp));

  return people.map((person) => {
    const name = person.displayName ?? person.name;
    const a = acc.get(person.id)!;

    // Character level: base XP plus bonus XP earned since the reset line.
    const totalXp = a.xp + (lifetimeBonus.get(person.id)?.total ?? 0) * XP_PER_EFFORT;
    const level = levelFromXp(totalXp);

    const stats: StatProgress[] = STAT_ORDER.map((key) => {
      const s = levelFromXp(a.statXp[key]);
      return { key, label: STAT_META[key].stat, level: s.level, pct: s.pct };
    });

    // Season tier from this month's completion, topped by initiative bonus.
    const completionPct = a.month.assigned
      ? (a.month.complete / a.month.assigned) * 100
      : 0;
    const season = seasonTier(
      completionPct,
      seasonBonus.get(person.id)?.total ?? 0,
    );

    // Streaks from the day buckets (gaps bridge, a real miss breaks).
    const dayClasses: DayClass[] = [...a.days.entries()]
      .sort((x, y) => (x[0] < y[0] ? -1 : 1))
      .map(([, b]): DayClass => {
        if (b.missed > 0) return "miss";
        if (b.complete === b.assigned) return "clean";
        return "neutral";
      });
    const { current, longest } = computeStreaks(dayClasses);

    const perfectWeeks = [...a.weeks.entries()].filter(
      ([wkISO, b]) =>
        b.assigned > 0 && b.complete === b.assigned && addDays(wkISO, 6) < today,
    ).length;

    // Best completed week (self-competition personal best).
    let bestWeekPct: number | null = null;
    for (const [wkISO, b] of a.weeks) {
      if (b.assigned > 0 && addDays(wkISO, 6) < today) {
        const p = Math.round((b.complete / b.assigned) * 100);
        if (bestWeekPct == null || p > bestWeekPct) bestWeekPct = p;
      }
    }

    const masteries: MasteryTitle[] = [...a.mastery.values()]
      .map((m) => ({ ...m, rank: masteryRank(m.count) }))
      .filter((m) => m.rank.rank > 0)
      .sort((x, y) => y.count - x.count)
      .slice(0, 3)
      .map((m) => ({ title: m.rank.title, chore: m.chore, count: m.count }));

    return {
      id: person.id,
      name,
      color: person.color,
      avatarPath: person.avatarPath,
      avatarPosition: person.avatarPosition,
      className: classFromSignature(
        signatureOf(a.statXp, baseline),
        a.statXp,
      ),
      level,
      stats,
      season,
      currentStreak: current,
      longestStreak: longest,
      milestones: earnedMilestones(longest),
      perfectWeeks,
      bestWeekPct,
      masteries,
      companionColor: blendPalette(signatureOf(a.statXp, baseline)),
      companion: (() => {
        const st = stateByUser.get(person.id);
        const baseXp = st?.incubationBaseXp ?? 0;
        const eggsHatched = st?.eggsHatched ?? 0;
        const cost = eggCostFor(eggsHatched);
        const progress = Math.max(0, totalXp - baseXp);
        const incubationPct = Math.min(100, Math.round((progress / cost) * 100));
        const eggsThisSeason =
          st && st.seasonKey === seasonWin.startISO ? st.eggsThisSeason : 0;
        const eggReady = progress >= cost && eggsThisSeason < EGGS_PER_SEASON_CAP;
        const active = activeByUser.get(person.id);
        if (active) {
          const tenure = Math.max(0, totalXp - active.activeSinceXp);
          return {
            active: true,
            species: active.species,
            stage: stageForTenure(tenure),
            shiny: active.shiny,
            incubationPct,
            eggReady,
          };
        }
        return {
          active: false,
          species: null,
          stage: 0,
          shiny: false,
          incubationPct,
          eggReady,
        };
      })(),
      statShares: (() => {
        const t = STAT_ORDER.reduce((n, k) => n + a.statXp[k], 0);
        const s = {} as Record<StatKey, number>;
        for (const k of STAT_ORDER) s[k] = t > 0 ? a.statXp[k] / t : 0;
        return s;
      })(),
      lifetimeXp: totalXp,
    };
  });
}

/** One person's progression, for their own page. */
export async function loadPersonProgress(
  userId: string,
): Promise<PersonProgress | null> {
  const rows = await loadProgression();
  return rows.find((p) => p.id === userId) ?? null;
}
