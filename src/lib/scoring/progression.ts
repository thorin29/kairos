/**
 * Progression math for "Seasons" — the RPG-style layer that sits on top of the
 * fairness engine. Pure and dependency-free.
 *
 * Two lifespans:
 *   - Character level and per-category stats climb forever and never drop.
 *     They're the personal grind, driven by raw XP, and are what "levelling up
 *     yourself" means. (They only ever start over on a hard reset, which is a
 *     scoring-window move, not anything here.)
 *   - The season tier ladder refills each month, so a newer or younger kid is
 *     never permanently behind.
 *
 * Nothing here ranks anyone against anyone. You climb; that's the whole game.
 */

/** XP for one unit of effort finished. Chores carry their 1-5 effort; other
 *  work is flat, so most completions are 10 XP and a heavy chore is more. */
export const XP_PER_EFFORT = 10;

// ---- Character level curve --------------------------------------------------
// Fast early levels for momentum, then a gentle classic RPG ramp.

const LEVEL_BASE = 100;
const LEVEL_GROWTH = 1.18;
const MAX_LEVEL = 500;

/** XP to go from `level` to `level + 1`. */
export function levelCost(level: number): number {
  return Math.round(LEVEL_BASE * Math.pow(LEVEL_GROWTH, level - 1));
}

export type LevelState = {
  level: number;
  /** XP banked into the current level. */
  intoLevel: number;
  /** XP the current level spans. */
  span: number;
  /** 0-100 progress toward the next level. */
  pct: number;
  totalXp: number;
};

export function levelFromXp(totalXp: number): LevelState {
  let level = 1;
  let acc = 0;
  while (level < MAX_LEVEL) {
    const cost = levelCost(level);
    if (acc + cost > totalXp) break;
    acc += cost;
    level += 1;
  }
  const intoLevel = totalXp - acc;
  const span = levelCost(level);
  return {
    level,
    intoLevel,
    span,
    pct: span ? Math.round((intoLevel / span) * 100) : 0,
    totalXp,
  };
}

// ---- Season tier ladder -----------------------------------------------------
// Completion-based: doing all of *your own* work (fairness %, reachable by
// everyone regardless of load) carries you to the "season complete" tier. The
// last couple of tiers come only from initiative bonus, so going above and
// beyond reads as a higher tier instead of an awkward over-100% score.

export const SEASON_BASE_TIERS = 8; // tiers earned by completing your own work
export const SEASON_MAX_TIER = 10; // top two need initiative
const BONUS_PER_TIER = 3; // bonus points for each tier above "complete"

export type SeasonState = {
  tier: number;
  maxTier: number;
  /** True once your own work is fully done (reached the complete tier). */
  complete: boolean;
  /** 0-100 progress toward the next tier. */
  pct: number;
};

export function seasonTier(
  completionPct: number,
  bonusPoints: number,
): SeasonState {
  const base = Math.max(0, Math.min(100, completionPct));
  const perTier = 100 / SEASON_BASE_TIERS;
  const baseTier = Math.min(SEASON_BASE_TIERS, Math.floor(base / perTier));
  const complete = baseTier >= SEASON_BASE_TIERS;

  let tier = baseTier;
  let pct: number;
  if (!complete) {
    const into = base - baseTier * perTier;
    pct = Math.round((into / perTier) * 100);
  } else {
    const bonusTiers = Math.min(
      SEASON_MAX_TIER - SEASON_BASE_TIERS,
      Math.floor(bonusPoints / BONUS_PER_TIER),
    );
    tier = SEASON_BASE_TIERS + bonusTiers;
    if (tier >= SEASON_MAX_TIER) {
      tier = SEASON_MAX_TIER;
      pct = 100;
    } else {
      const into = bonusPoints - bonusTiers * BONUS_PER_TIER;
      pct = Math.round((into / BONUS_PER_TIER) * 100);
    }
  }

  return { tier, maxTier: SEASON_MAX_TIER, complete, pct };
}

// ---- Per-chore mastery ------------------------------------------------------
// A playful title per chore, earned by repetition — no comparison, just your
// own tally.

const MASTERY_TIERS: { at: number; title: string }[] = [
  { at: 75, title: "Master" },
  { at: 40, title: "Expert" },
  { at: 20, title: "Adept" },
  { at: 8, title: "Apprentice" },
  { at: 3, title: "Novice" },
];

export type Mastery = { rank: number; title: string };

/** Mastery for a completion count. rank 0 (below the first threshold) means
 *  no title yet. */
export function masteryRank(count: number): Mastery {
  for (let i = 0; i < MASTERY_TIERS.length; i++) {
    if (count >= MASTERY_TIERS[i].at) {
      return { rank: MASTERY_TIERS.length - i, title: MASTERY_TIERS[i].title };
    }
  }
  return { rank: 0, title: "" };
}

// ---- Emergent class ---------------------------------------------------------
// A "build" that falls out of where someone's XP actually goes, so kids
// naturally become different characters instead of racing one number.

export type StatKey = "CHORE" | "EXERCISE" | "BIBLE" | "SCHOOL" | "TASK";

export const STAT_META: Record<
  StatKey,
  { stat: string; className: string }
> = {
  CHORE: { stat: "Chores", className: "Homesteader" },
  EXERCISE: { stat: "Strength", className: "Athlete" },
  BIBLE: { stat: "Wisdom", className: "Sage" },
  SCHOOL: { stat: "Scholar", className: "Scholar" },
  TASK: { stat: "Life", className: "Adventurer" },
};

export const STAT_ORDER: StatKey[] = [
  "CHORE",
  "EXERCISE",
  "BIBLE",
  "SCHOOL",
  "TASK",
];

/** The class label for a spread of stat XP. One stat clearly out front names
 *  the build; an even spread is an All-Rounder. */
export function classFromStats(xpByStat: Record<StatKey, number>): string {
  const entries = STAT_ORDER.map((k) => [k, xpByStat[k] ?? 0] as const);
  const total = entries.reduce((n, [, xp]) => n + xp, 0);
  if (total === 0) return "Newcomer";

  let topKey: StatKey = "CHORE";
  let topXp = -1;
  for (const [k, xp] of entries) {
    if (xp > topXp) {
      topXp = xp;
      topKey = k;
    }
  }
  const share = topXp / total;
  return share >= 0.45 ? STAT_META[topKey].className : "All-Rounder";
}
