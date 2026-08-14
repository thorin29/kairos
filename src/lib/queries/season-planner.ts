import "server-only";
import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, toDateColumn, todayISO } from "@/lib/dates";
import { getSeasonConfig, type SeasonConfig } from "@/lib/settings";
import {
  taskEffort,
  groupForCategory,
  SCORE_GROUPS,
  type ScoreGroupKey,
} from "@/lib/scoring/weights";
import { XP_PER_EFFORT, levelFromXp } from "@/lib/scoring/progression";
import { generateChores } from "@/lib/chores/generate";
import { generatePoolChores } from "@/lib/chores/pool";
import { generateAnytimeChores } from "@/lib/chores/anytime";
import { generateWorkoutTasks } from "@/lib/workouts/generate";
import { generateReadingTasks } from "@/lib/bible/generate";

const PROJECTION_DAYS = 14; // two weeks of generated schedule
const RECO_RATE = 0.85; // realistic completion for the recommendation
const RECO_TARGET_LEVEL = 10; // "a satisfying season" landing level

export type PlannerPerson = {
  id: string;
  name: string;
  /** Earnable XP per week (own assigned work plus an even share of shared
   *  chores), at 100% completion. */
  weeklyXp: number;
  byGroup: { key: ScoreGroupKey; label: string; weeklyXp: number }[];
};

export type SeasonPlan = {
  people: PlannerPerson[];
  /** Shared (pool) chores can be done by anyone; shown separately and split
   *  evenly into each person's projection. */
  poolWeeklyXp: number;
  config: SeasonConfig;
  recommendation: {
    weeks: number;
    targetLevel: number;
    rate: number;
    /** Whose (slowest) load the recommendation ensures reaches the target. */
    slowestName: string | null;
  };
  /** School is the wobbly input — flag it if it's carrying much of the load. */
  schoolShare: number;
};

/**
 * A forward projection of how fast each person would level at the currently
 * loaded workload — a planning tool to pick a season length before locking the
 * co-op gate. It leans on the generators (which already apply every cadence:
 * weekly slots, fortnightly intervals, anytime periods) by materialising two
 * weeks and reading the rate off that. Pool chores are handled analytically
 * since they only ever put out one instance at a time.
 *
 * It's a ceiling: it assumes everything gets done. The client can dial the
 * completion rate down to see a realistic band.
 */
export async function loadSeasonPlan(): Promise<SeasonPlan> {
  const today = todayISO();
  const horizon = addDays(today, PROJECTION_DAYS - 1);

  // Make sure the window is populated (the same generation any page triggers).
  await Promise.all([
    generateChores(today),
    generateWorkoutTasks(today),
    generatePoolChores(today),
    generateReadingTasks(today),
    generateAnytimeChores(today),
  ]);

  const [people, tasks, poolChores] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true },
    }),
    prisma.task.findMany({
      where: {
        isOpen: false,
        status: { not: TaskStatus.SKIPPED },
        dueDate: { gte: toDateColumn(today), lte: toDateColumn(horizon) },
      },
      select: {
        userId: true,
        category: true,
        weight: true,
        choreId: true,
        chore: { select: { effort: true, isPool: true } },
      },
    }),
    prisma.chore.findMany({
      where: { isActive: true, isPool: true, isPaused: false },
      select: { effort: true, intervalDays: true },
    }),
  ]);

  const weeks = PROJECTION_DAYS / 7;

  // Per-person weekly XP by group, from their own assigned (non-pool) work.
  const byUser = new Map<string, Map<ScoreGroupKey, number>>();
  for (const p of people) {
    const m = new Map<ScoreGroupKey, number>();
    for (const g of SCORE_GROUPS) m.set(g.key, 0);
    byUser.set(p.id, m);
  }
  for (const t of tasks) {
    if (t.chore?.isPool) continue; // shared chores counted analytically
    const m = byUser.get(t.userId);
    if (!m) continue;
    const key = groupForCategory(t.category);
    const xp = taskEffort({ choreEffort: t.chore?.effort ?? null, taskWeight: t.weight }) * XP_PER_EFFORT;
    m.set(key, (m.get(key) ?? 0) + xp);
  }

  // Shared chores: one roughly every intervalDays, split evenly.
  let poolWeeklyXp = 0;
  for (const c of poolChores) {
    const every = c.intervalDays && c.intervalDays > 0 ? c.intervalDays : 7;
    poolWeeklyXp += c.effort * XP_PER_EFFORT * (7 / every);
  }
  const count = Math.max(1, people.length);
  const poolShare = poolWeeklyXp / count;

  let schoolTotal = 0;
  let grandTotal = 0;

  const plannerPeople: PlannerPerson[] = people.map((p) => {
    const m = byUser.get(p.id)!;
    const byGroup = SCORE_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      weeklyXp: Math.round((m.get(g.key) ?? 0) / weeks),
    }));
    const own = byGroup.reduce((n, g) => n + g.weeklyXp, 0);
    const weeklyXp = Math.round(own + poolShare);
    schoolTotal += byGroup.find((g) => g.key === "SCHOOL")?.weeklyXp ?? 0;
    grandTotal += weeklyXp;
    return { id: p.id, name: p.displayName ?? p.name, weeklyXp, byGroup };
  });

  // Recommend a length that gets even the slowest earner to the target level.
  const earners = plannerPeople.filter((p) => p.weeklyXp > 0);
  const slowest = earners.length
    ? earners.reduce((a, b) => (b.weeklyXp < a.weeklyXp ? b : a))
    : null;
  const recWeeks = slowest
    ? weeksToLevel(slowest.weeklyXp, RECO_RATE, RECO_TARGET_LEVEL)
    : 4;

  return {
    people: plannerPeople,
    poolWeeklyXp: Math.round(poolWeeklyXp),
    config: await getSeasonConfig(),
    recommendation: {
      weeks: recWeeks,
      targetLevel: RECO_TARGET_LEVEL,
      rate: RECO_RATE,
      slowestName: slowest?.name ?? null,
    },
    schoolShare: grandTotal > 0 ? Math.round((schoolTotal / grandTotal) * 100) : 0,
  };
}

/** Fewest whole weeks for a weekly-XP rate to reach a level (capped at 26). */
function weeksToLevel(weeklyXp: number, rate: number, target: number): number {
  for (let w = 1; w <= 26; w++) {
    if (levelFromXp(weeklyXp * w * rate).level >= target) return w;
  }
  return 26;
}
