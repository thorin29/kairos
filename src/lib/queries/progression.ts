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
import { getScoringStart, getSeasonConfig } from "@/lib/settings";
import { resolveSeasonWindow } from "@/lib/season";
import { bankedGrowthFloor, blendPalette, companionPhase, type CompanionPhase } from "@/lib/companions";
import { taskEffort, groupForCategory } from "@/lib/scoring/weights";
import {
  growthSince as growthBetween,
  growthMix,
  creditBetween,
  dayCredit,
  emptyDay,
  recentCompletion,
  luckFromCompletion,
  type DayBucket,
} from "@/lib/companions-growth";
import { CLEAN_DAY_STAGES, DEEPEN_GROWTH } from "@/lib/companions";
import { readingXpForBook, bibleXpForChapters } from "@/lib/scoring/reading";
import { loadBonuses } from "@/lib/queries/bonus";
import { isStale, loadStaleContext, type StaleInput } from "@/lib/chores/stale";
import { computeStreaks, earnedMilestones, type DayClass } from "@/lib/scoring/streaks";
import {
  XP_PER_EFFORT,
  TEST_SCORE_BONUS_XP,
  SPORT_LIFE_XP,
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
  /** Clean days completed so far this month — resolved past days where the child
   *  finished everything assigned that day. Accumulates; never drops. */
  monthlyCleanDays: number;
  /** This month's days of work: the sum of each day's credit (share of the
   *  day's list finished, 0..1; today live). The family goal counts these. */
  monthlyCredit: number;
  /** The same, by season window (startISO), so a carried goal is judged on its
   *  own month. */
  creditBySeason: Record<string, number>;
  /** Today's credit so far, 0..1 (what today adds to growth right now). */
  todayCredit: number;
  /** Average credit over the last 14 settled days with anything due (0..1). */
  recentCompletion: number;
  /** This month's effort due/done, by stat. */
  monthByStat: Record<StatKey, { due: number; done: number }>;
  /** The same count, bucketed by the season window each day falls in. A family
   *  goal carried over from an earlier month has to be judged on ITS month, not
   *  on the current one: the question "did everyone finish September?" cannot be
   *  answered by a counter that reset on October 1. Keyed by window startISO. */
  cleanDaysBySeason: Record<string, number>;
  bestWeekPct: number | null;
  masteries: MasteryTitle[];
  /** The companion display: an incubating egg, or the active creature. Color
   *  is the skill-blend fingerprint on the card frame either way. */
  companionColor: string;
  companion: {
    active: boolean;
    species: string | null;
    stage: number;
    shiny: boolean;
    /** Where it is in its life: growing, adult, deepening, shiny. One phase at a
     *  time, and the end of each one unlocks something. */
    phase: CompanionPhase;
    /** Progress through the CURRENT phase, 0-100. Growth toward adult while
     *  growing; toward the glow while deepening; 100 when something is waiting
     *  to be spent. */
    incubationPct: number;
    eggReady: boolean;
    /** Kept so older clients keep decoding; nothing sets it now that growth,
     *  not a monthly allowance, paces hatching. */
    eggCapped: boolean;
    /** Total growth this companion has earned, banked tenures included. Written
     *  back when it retires, so bringing it out of the gallery resumes rather
     *  than restarting. Zero when there is no companion. */
    growth: number;
    /** The same growth without today's live credit — what is banked if it goes
     *  to the gallery now (today then belongs to whoever takes over). */
    settledGrowth: number;
    /** Today's part of `growth` (drawn lighter: it can still change today). */
    pendingGrowth: number;
    /** Growth needed to finish the current phase: 12 to adult while growing,
     *  6 while deepening; null when nothing is being grown (adult, shiny). */
    phaseGoal: number | null;
    /** Progress through the current phase, in the same units as phaseGoal. */
    phaseProgress: number;
    /** What earned this companion's growth, by stat (sums to 1, or all 0). */
    growthMix: Record<StatKey, number>;
    /** 0..1 odds for the next hatch, from recent completion (last 14 days).
     *  Drives the egg meter's colour. */
    luck: number;
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
  const seasonCfg = await getSeasonConfig();
  const seasonWin = resolveSeasonWindow(seasonCfg, today);
  const seasonStart = seasonWin.startISO;
  const startISO = await getScoringStart();
  const dueFloor = startISO ? { gte: toDateColumn(startISO) } : {};

  const [people, tasks, ctx, seasonBonus, lifetimeBonus, compStates, activeComps, books, chapterReads, sportSessions] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true, color: true, avatarPath: true, avatarPosition: true },
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
        position: true,
      },
    }),
    // Personal Bible reading feeds Wisdom slightly (one row per chapter read).
    prisma.userChapterRead.findMany({ select: { userId: true } }),
    // Confirmed team sport (a practice or game from the calendar, "Yes, I did
    // it") feeds Life: showing up for the team. The same confirmation also
    // completes the day's workout task (Strength) — that is the workout; this
    // is the team. One per event per day.
    prisma.workoutSession.findMany({
      where: {
        category: "SPORT",
        sourceEventId: { not: null },
        finished: true,
        isRest: false,
        date: { lte: toDateColumn(today), ...dueFloor },
      },
      select: { userId: true },
    }),
  ]);

  type StateRow = {
    userId: string;
    incubationBaseXp: number;
    eggsHatched: number;
    seasonKey: string | null;
    eggsThisSeason: number;
  };
  type ActiveRow = { userId: string; species: string; shiny: boolean; activeSinceXp: number; acquiredAt: Date; deepeningStartedAt: Date | null; growthBanked: number; tenureStartedAt: Date | null; mintedStage: number | null };
  const stateByUser = new Map(
    (compStates as StateRow[]).map((s) => [s.userId, s]),
  );
  const activeByUser = new Map(
    (activeComps as ActiveRow[]).map((c) => [c.userId, c]),
  );

  type Acc = {
    xp: number;
    statXp: Record<StatKey, number>;
    days: Map<string, DayBucket>;
    weeks: Map<string, { assigned: number; complete: number }>;
    month: { assigned: number; complete: number };
    /** This month's effort due and done, by stat (for the scoring snapshot). */
    monthByStat: Record<StatKey, { due: number; done: number }>;
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
        monthByStat: {
          CHORE: { due: 0, done: 0 },
          EXERCISE: { due: 0, done: 0 },
          BIBLE: { due: 0, done: 0 },
          SCHOOL: { due: 0, done: 0 },
          TASK: { due: 0, done: 0 },
        },
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

    const day = a.days.get(dayISO) ?? emptyDay();
    day.assigned += 1;
    day.effort += effort;
    if (complete) {
      day.complete += 1;
      day.effortDone += effort;
      day.doneByStat[stat] += effort;
    } else if (isStale(t as StaleInput, today, ctx)) day.missed += 1;
    a.days.set(dayISO, day);

    const wk = a.weeks.get(weekISO) ?? { assigned: 0, complete: 0 };
    wk.assigned += effort;
    if (complete) wk.complete += effort;
    a.weeks.set(weekISO, wk);

    if (dayISO >= seasonStart) {
      a.month.assigned += effort;
      if (complete) a.month.complete += effort;
      a.monthByStat[stat].due += effort;
      if (complete) a.monthByStat[stat].done += effort;
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
    position: number;
  }[]) {
    const a = acc.get(b.userId);
    if (!a) continue;
    const xp = readingXpForBook(b.unit, b.length, b.position);
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

  for (const r of sportSessions as { userId: string }[]) {
    const a = acc.get(r.userId);
    if (!a) continue;
    a.xp += SPORT_LIFE_XP;
    a.statXp.TASK += SPORT_LIFE_XP;
  }

  // The family baseline per stat, so class and color reflect what each person
  // does *above* the shared norm — universal work cancels out.
  const baseline = computeBaseline(people.map((p: { id: string }) => acc.get(p.id)!.statXp));

  type PersonRow = {
    id: string;
    name: string;
    displayName: string | null;
    color: string;
    avatarPath: string | null;
    avatarPosition: string | null;
  };
  return (people as PersonRow[]).map((person) => {
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

    // Clean days: resolved past days (before today, so it can only climb) where
    // the child finished everything assigned. Fair across loads — a light day
    // still counts if you finish it.
    //
    // Bucketed by the season window each day belongs to, rather than filtered to
    // the current one, so an earlier month's total is still answerable. Uses the
    // same resolver as the live window, so it stays right in "weeks" mode too
    // instead of assuming a calendar month.
    const cleanDaysBySeason: Record<string, number> = {};
    for (const [iso, b] of a.days) {
      if (
        iso < today &&
        b.assigned > 0 &&
        b.missed === 0 &&
        b.complete === b.assigned
      ) {
        const key = resolveSeasonWindow(seasonCfg, iso).startISO;
        cleanDaysBySeason[key] = (cleanDaysBySeason[key] ?? 0) + 1;
      }
    }
    const monthlyCleanDays = cleanDaysBySeason[seasonStart] ?? 0;

    // Days of work per season window: each day's credit (0..1, today live),
    // summed. The family goal counts these — a 90% day is 0.9 of a day, not 0.
    const creditBySeason: Record<string, number> = {};
    for (const [iso, b] of a.days) {
      if (iso > today || b.effort <= 0) continue;
      const key = resolveSeasonWindow(seasonCfg, iso).startISO;
      creditBySeason[key] = (creditBySeason[key] ?? 0) + dayCredit(b);
    }
    const monthlyCredit = creditBet(seasonStart);
    function creditBet(fromISO: string): number {
      return creditBetween(a.days, fromISO, seasonWin.endISO, today);
    }
    const todayCredit = dayCredit(a.days.get(today));
    // Egg luck from how steadily the list gets finished, not from the streak.
    const recent = recentCompletion(a.days, today);
    const luck = luckFromCompletion(recent);

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
      monthlyCleanDays,
      cleanDaysBySeason,
      monthlyCredit,
      creditBySeason,
      todayCredit,
      recentCompletion: recent,
      monthByStat: a.monthByStat,
      bestWeekPct,
      masteries,
      companionColor: blendPalette(signatureOf(a.statXp, baseline)),
      companion: (() => {
        const active = activeByUser.get(person.id);
        // Growth is the ONLY currency now. The old incubation meter ran on
        // lifetime XP, which accrues from everything and so filled eggs while
        // the creature in front of you had not grown — that is where "a new egg
        // is ready" under a hatchling came from.
        // One rule for what a day is worth and whose it is (companions-growth.ts):
        // shown growth counts today live; banked growth stops at yesterday.
        const growthSince = (fromISO: string) => growthBetween(a.days, a.weeks, fromISO, today, true);
        const settledSince = (fromISO: string) => growthBetween(a.days, a.weeks, fromISO, today, false);

        if (!active) {
          // No companion yet: the first egg is simply there to hatch, so a new
          // person is not staring at an empty card with nothing to do.
          return {
            active: false as const,
            species: null,
            stage: 0,
            shiny: false,
            phase: "adult" as const,
            incubationPct: 100,
            eggReady: true,
            eggCapped: false,
            growth: 0,
            settledGrowth: 0,
            pendingGrowth: 0,
            phaseGoal: null,
            phaseProgress: 0,
            growthMix: { CHORE: 0, EXERCISE: 0, BIBLE: 0, SCHOOL: 0, TASK: 0 },
            luck,
          };
        }

        // Growth = what it banked in earlier tenures + what it has done in this
        // one. A companion brought back from the gallery keeps what it earned
        // and nothing more: measuring from `acquiredAt` would credit it every
        // clean day since it first hatched, including the ones it spent shelved.
        // The household day it was made active — not the UTC date, which
        // turned an evening swap into tomorrow.
        const tenureISO = todayISO(active.tenureStartedAt ?? active.acquiredAt);
        // Never below the stage the gallery showed it at (bankedGrowthFloor).
        const banked = Math.max(active.growthBanked, bankedGrowthFloor(active.mintedStage));
        const deepFromISO = active.deepeningStartedAt
          ? todayISO(active.deepeningStartedAt)
          : null;
        // No back-fill of growth older swaps dropped (tried in 0.602.0): rows
        // shelved before 0.576 hold only their stage's floor, not what they
        // earned, so "earned minus what the shelf holds" credited a fresh
        // hatchling with months of old growth. See DECISIONS 0.602.1.
        const totalGrowth = banked + growthSince(tenureISO);
        const settledGrowth = banked + settledSince(tenureISO);
        const deepenGrowth = deepFromISO ? growthSince(deepFromISO) : 0;
        const ph = companionPhase({
          growth: totalGrowth,
          deepenGrowth,
          deepening: deepFromISO !== null,
          shiny: active.shiny,
        });
        // Only one thing grows at a time: toward adult, then (if chosen)
        // toward the glow. Adult and shiny wait on a choice, so nothing fills.
        const phaseGoal =
          ph.phase === "growing" ? CLEAN_DAY_STAGES[2] : ph.phase === "deepening" ? DEEPEN_GROWTH : null;
        const phaseProgress =
          ph.phase === "growing"
            ? Math.min(totalGrowth, CLEAN_DAY_STAGES[2])
            : ph.phase === "deepening"
              ? Math.min(deepenGrowth, DEEPEN_GROWTH)
              : 0;

        return {
          active: true as const,
          species: active.species,
          growth: totalGrowth,
          stage: ph.stage,
          // Finishing the deepen IS being shiny; the column catches up when the
          // companion retires, so the gallery copy is right without this view
          // having to write on read.
          shiny: ph.phase === "shiny",
          phase: ph.phase,
          incubationPct: ph.pct,
          eggReady: ph.eggReady,
          eggCapped: false,
          settledGrowth,
          pendingGrowth: Math.max(0, totalGrowth - settledGrowth),
          phaseGoal,
          phaseProgress,
          growthMix: growthMix(a.days, tenureISO, today, true),
          luck,
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
