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
/**
 * The family baseline per stat — the average XP everyone has in each area.
 * Universal work (everyone reads the Bible the same amount) piles up here, so
 * it becomes the floor everyone stands on rather than anyone's signature.
 */
export function computeBaseline(
  all: Record<StatKey, number>[],
): Record<StatKey, number> {
  const base: Record<StatKey, number> = {
    CHORE: 0,
    EXERCISE: 0,
    BIBLE: 0,
    SCHOOL: 0,
    TASK: 0,
  };
  if (all.length === 0) return base;
  for (const s of all) for (const k of STAT_ORDER) base[k] += s[k] ?? 0;
  for (const k of STAT_ORDER) base[k] /= all.length;
  return base;
}

/**
 * Your signature: how much you do *above* the family baseline in each area.
 * This is what actually differentiates people who are assigned similar work —
 * doing the daily minimum everyone does contributes nothing; rising above the
 * norm (extra workouts, extra chores, reading past the plan) is what defines
 * your class and your companion's colour.
 */
export function signatureOf(
  statXp: Record<StatKey, number>,
  baseline: Record<StatKey, number>,
): Record<StatKey, number> {
  const sig: Record<StatKey, number> = {
    CHORE: 0,
    EXERCISE: 0,
    BIBLE: 0,
    SCHOOL: 0,
    TASK: 0,
  };
  for (const k of STAT_ORDER) sig[k] = Math.max(0, (statXp[k] ?? 0) - (baseline[k] ?? 0));
  return sig;
}

/**
 * The class from a signature. No activity at all → Newcomer; activity but no
 * area clearly above the family norm → All-Rounder (honest: two kids who do
 * everything identically are both All-Rounders, and their random companions are
 * what set them apart). One area clearly ahead names the class.
 */
export function classFromSignature(
  sig: Record<StatKey, number>,
  rawTotal: number,
): string {
  if (rawTotal <= 0) return "Newcomer";
  const total = STAT_ORDER.reduce((n, k) => n + sig[k], 0);
  if (total <= 0) return "All-Rounder";

  let topKey: StatKey = "CHORE";
  let topXp = -1;
  for (const k of STAT_ORDER) {
    if (sig[k] > topXp) {
      topXp = sig[k];
      topKey = k;
    }
  }
  return topXp / total >= 0.45 ? STAT_META[topKey].className : "All-Rounder";
}
