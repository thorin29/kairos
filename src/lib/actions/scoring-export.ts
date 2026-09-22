"use server";

import { requireAdmin } from "@/lib/session";
import { loadProgression } from "@/lib/queries/progression";
import { loadCoop } from "@/lib/queries/coop";
import { loadSeasonPlan } from "@/lib/queries/season-planner";
import { currentSeasonWindow } from "@/lib/season";
import {
  XP_PER_EFFORT,
  TEST_SCORE_BONUS_XP,
  SEASON_BASE_TIERS,
  SEASON_MAX_TIER,
} from "@/lib/scoring/progression";
import {
  STAGE_LEVELS,
  STAGE_NAMES,
  FIRST_EGG_XP,
  EGG_XP,
  TENURE_STAGE_XP,
} from "@/lib/companions";

/**
 * A read-only JSON snapshot of the whole scoring state: the engine constants,
 * the current season window, the family co-op goal, and every person's live
 * numbers — level and lifetime XP, per-stat levels, this season's tier and
 * completion, streaks, their companion, and their weekly earn rate broken down
 * by domain (chores vs school vs …). Copied out of the admin season planner for
 * tuning. Writes nothing.
 */
export async function exportScoringSnapshot(): Promise<string> {
  await requireAdmin();

  const [progression, coop, plan, season] = await Promise.all([
    loadProgression(),
    loadCoop(),
    loadSeasonPlan(),
    currentSeasonWindow(),
  ]);

  const weeklyById = new Map(
    plan.people.map((p) => [p.id, { weeklyXp: p.weeklyXp, byDomain: p.byGroup }]),
  );

  const snapshot = {
    generatedAt: new Date().toISOString(),
    season: {
      label: season.label,
      startISO: season.startISO,
      endISO: season.endISO,
      weeks: season.weeks,
      mode: plan.config.mode,
      configuredWeeks: plan.config.weeks,
    },
    engine: {
      xpPerEffort: XP_PER_EFFORT,
      testScoreBonusXp: TEST_SCORE_BONUS_XP,
      seasonBaseTiers: SEASON_BASE_TIERS,
      seasonMaxTier: SEASON_MAX_TIER,
      levelStages: STAGE_NAMES,
      stageLevels: STAGE_LEVELS,
      firstEggXp: FIRST_EGG_XP,
      eggXp: EGG_XP,
      tenureStageXp: TENURE_STAGE_XP,
    },
    familyGoal: {
      floorTier: coop.floor,
      childrenMeeting: coop.childrenMeeting,
      childrenTotal: coop.childrenTotal,
      perChild: coop.children.map((c) => ({
        name: c.name,
        tier: c.tier,
        meets: c.meets,
      })),
    },
    people: progression.map((p) => {
      const w = weeklyById.get(p.id);
      return {
        name: p.name,
        class: p.className,
        level: p.level.level,
        lifetimeXp: p.lifetimeXp,
        intoLevel: p.level.intoLevel,
        levelSpan: p.level.span,
        statLevels: p.stats.map((s) => ({ stat: s.label, level: s.level })),
        season: {
          tier: p.season.tier,
          complete: p.season.complete,
          pctIntoNextTier: p.season.pct,
        },
        streak: { current: p.currentStreak, longest: p.longestStreak },
        perfectWeeks: p.perfectWeeks,
        bestWeekPct: p.bestWeekPct,
        companion: {
          species: p.companion.species,
          stage: p.companion.stage,
          incubationPct: p.companion.incubationPct,
          eggReady: p.companion.eggReady,
        },
        // Earnable XP per week at 100% completion, and where it comes from — this
        // is the workload composition that shows who has an easier or heavier load.
        weeklyXpAt100: w?.weeklyXp ?? null,
        weeklyByDomain: w?.byDomain ?? null,
      };
    }),
  };

  return JSON.stringify(snapshot, null, 2);
}
