"use server";

import { requireAdmin } from "@/lib/session";
import { loadProgression } from "@/lib/queries/progression";
import { loadCoop } from "@/lib/queries/coop";
import { loadSeasonPlan } from "@/lib/queries/season-planner";
import { currentSeasonWindow } from "@/lib/season";
import {
  XP_PER_EFFORT,
  TEST_SCORE_BONUS_XP,
  SPORT_LIFE_XP,
  STAT_META,
  STAT_ORDER,
} from "@/lib/scoring/progression";
import { CLEAN_DAY_STAGES, DEEPEN_GROWTH, STAGE_NAMES } from "@/lib/companions";
import { WEEK_GROWTH } from "@/lib/companions-growth";

const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (done: number, due: number) => (due > 0 ? Math.round((done / due) * 100) : null);

/**
 * A read-only JSON snapshot of the whole scoring state, copied out of the admin
 * season planner for tuning: the rules as they are now (docs/SCORING.md), the
 * family goal, and every person's live numbers — level, skills, this month's
 * days of work and completion by skill, character growth and phase, egg luck,
 * streaks, and their weekly XP at 100% by domain. Writes nothing.
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
    rules: {
      doc: "docs/SCORING.md",
      xp: {
        perEffortPoint: XP_PER_EFFORT,
        choreEffortRange: [1, 5],
        otherTasks: XP_PER_EFFORT,
        testScoreBonusMax: TEST_SCORE_BONUS_XP,
        perConfirmedSportEvent: SPORT_LIFE_XP,
      },
      growth: {
        dayCredit: "effort done / effort due that day (0..1); today live",
        perfectWeekBonus: WEEK_GROWTH,
        stages: STAGE_NAMES,
        stageThresholds: CLEAN_DAY_STAGES,
        deepenGrowth: DEEPEN_GROWTH,
        eggs: "egg only when adult (or shiny); hatch or deepen; never while growing",
        luck: "(average day credit over the last 14 settled days - 0.5) / 0.5, clamped 0..1",
      },
      familyGoal: {
        measure: "days of work this month (sum of day credits)",
        targetDays: coop.target,
      },
    },
    season: {
      label: season.label,
      startISO: season.startISO,
      endISO: season.endISO,
      mode: plan.config.mode,
    },
    familyGoal: {
      targetDays: coop.target,
      childrenMeeting: coop.childrenMeeting,
      childrenTotal: coop.childrenTotal,
      perChild: coop.children.map((c) => ({
        name: c.name,
        days: r1(c.credit),
        meets: c.meets,
      })),
    },
    people: progression.map((p) => {
      const w = weeklyById.get(p.id);
      const due = STAT_ORDER.reduce((n, k) => n + p.monthByStat[k].due, 0);
      const done = STAT_ORDER.reduce((n, k) => n + p.monthByStat[k].done, 0);
      return {
        name: p.name,
        class: p.className,
        level: p.level.level,
        lifetimeXp: p.lifetimeXp,
        intoLevel: p.level.intoLevel,
        levelSpan: p.level.span,
        skills: p.stats.map((s) => ({ skill: s.label, level: s.level })),
        thisMonth: {
          daysOfWork: r1(p.monthlyCredit),
          perfectDays: p.monthlyCleanDays,
          completionPct: pct(done, due),
          completionBySkill: STAT_ORDER.map((k) => ({
            skill: STAT_META[k].stat,
            due: p.monthByStat[k].due,
            done: p.monthByStat[k].done,
            pct: pct(p.monthByStat[k].done, p.monthByStat[k].due),
          })),
        },
        today: { credit: r1(p.todayCredit) },
        last14DaysCompletionPct: Math.round(p.recentCompletion * 100),
        streak: { current: p.currentStreak, longest: p.longestStreak },
        perfectWeeks: p.perfectWeeks,
        bestWeekPct: p.bestWeekPct,
        character: {
          species: p.companion.species,
          stage: p.companion.active ? (STAGE_NAMES[p.companion.stage] ?? null) : null,
          phase: p.companion.active ? p.companion.phase : "egg",
          growth: r1(p.companion.growth),
          growthToday: r1(p.companion.pendingGrowth),
          phaseProgress:
            p.companion.phaseGoal != null
              ? `${r1(p.companion.phaseProgress)} / ${p.companion.phaseGoal}`
              : null,
          eggReady: p.companion.eggReady,
          luck: r1(p.companion.luck),
        },
        // Earnable XP per week at 100% completion, and where it comes from — the
        // workload composition that shows who has an easier or heavier load.
        weeklyXpAt100: w?.weeklyXp ?? null,
        weeklyByDomain: w?.byDomain ?? null,
      };
    }),
  };

  return JSON.stringify(snapshot, null, 2);
}
