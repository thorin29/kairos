import "server-only";
import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { getScoringStart } from "@/lib/settings";
import {
  SCORE_GROUPS,
  groupForCategory,
  taskEffort,
  type ScoreGroupKey,
} from "@/lib/scoring/weights";

export type GroupScore = {
  key: ScoreGroupKey;
  label: string;
  assigned: number;
  complete: number;
  /** null when nothing was assigned in this group — renders neutral. */
  percent: number | null;
};

export type Standing = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  /** Effort assigned and completed across every scored category. */
  assigned: number;
  complete: number;
  /** The fairness score: completed effort over assigned effort, 0..100. */
  percent: number | null;
  groups: GroupScore[];
};

/**
 * The fairness score for a date range. For each person we sum the effort of
 * what they were assigned and what they finished, then a ratio: everyone can
 * reach 100% regardless of how much or how heavy their load was, which is the
 * whole point — being handed more can't sink you.
 *
 * Skipped work is excused (out of both sides); paused days generate no rows,
 * so a partial week or a vacation simply shrinks the denominator for free.
 * Released chores belong to nobody until claimed, so they sit out until then.
 * A chore that expired unfinished stays assigned-but-not-complete, so a real
 * miss shows as a dip — but merely being late, while still catchable, doesn't:
 * finishing it later moves it into the completed side.
 *
 * The scoring-start pointer floors the range, so a reset (or a testing period)
 * cleanly excludes everything before it without deleting anything.
 */
export async function loadStandings(
  fromISO: string,
  toISO: string,
): Promise<Standing[]> {
  const startISO = await getScoringStart();
  const effectiveFrom = startISO && startISO > fromISO ? startISO : fromISO;

  // A reset dated after the window means nothing in range counts yet.
  if (effectiveFrom > toISO) {
    const people = await activePeople();
    return people.map((p) => emptyStanding(p));
  }

  const [people, tasks] = await Promise.all([
    activePeople(),
    prisma.task.findMany({
      where: {
        isOpen: false,
        status: { not: TaskStatus.SKIPPED },
        dueDate: {
          gte: toDateColumn(effectiveFrom),
          lte: toDateColumn(toISO),
        },
      },
      select: {
        userId: true,
        category: true,
        status: true,
        weight: true,
        chore: { select: { effort: true } },
      },
    }),
  ]);

  // Seed a zeroed group map per person so everyone appears, even with nothing
  // assigned yet.
  const byUser = new Map<string, Map<ScoreGroupKey, { assigned: number; complete: number }>>();
  const seed = (userId: string) => {
    let groups = byUser.get(userId);
    if (!groups) {
      groups = new Map();
      for (const g of SCORE_GROUPS) groups.set(g.key, { assigned: 0, complete: 0 });
      byUser.set(userId, groups);
    }
    return groups;
  };
  for (const p of people) seed(p.id);

  for (const t of tasks) {
    const groups = seed(t.userId);
    const key = groupForCategory(t.category);
    const bucket = groups.get(key)!;
    const effort = taskEffort({
      choreEffort: t.chore?.effort ?? null,
      taskWeight: t.weight,
    });
    bucket.assigned += effort;
    if (t.status === TaskStatus.COMPLETE) bucket.complete += effort;
  }

  return people.map((p) => {
    const groups = byUser.get(p.id)!;
    const groupScores: GroupScore[] = SCORE_GROUPS.map((g) => {
      const b = groups.get(g.key)!;
      return {
        key: g.key,
        label: g.label,
        assigned: b.assigned,
        complete: b.complete,
        percent: b.assigned ? Math.round((b.complete / b.assigned) * 100) : null,
      };
    });
    const assigned = groupScores.reduce((n, g) => n + g.assigned, 0);
    const complete = groupScores.reduce((n, g) => n + g.complete, 0);
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      avatarPath: p.avatarPath,
      assigned,
      complete,
      percent: assigned ? Math.round((complete / assigned) * 100) : null,
      groups: groupScores,
    };
  });
}

type Person = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
};

async function activePeople(): Promise<Person[]> {
  const rows = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      avatarPath: true,
    },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.displayName ?? p.name,
    color: p.color,
    avatarPath: p.avatarPath,
  }));
}

function emptyStanding(p: Person): Standing {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    avatarPath: p.avatarPath,
    assigned: 0,
    complete: 0,
    percent: null,
    groups: SCORE_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      assigned: 0,
      complete: 0,
      percent: null,
    })),
  };
}

/**
 * Rank for "who's ahead": the fairness score first, and among equally-caught-up
 * people whoever has done more effort shows in front. This secondary tiebreak
 * is a stand-in until the initiative bonuses (get-ahead, streaks) land and
 * become the real differentiator between two people both at 100%.
 */
export function rankStandings(standings: Standing[]): Standing[] {
  return [...standings].sort(
    (a, b) => (b.percent ?? -1) - (a.percent ?? -1) || b.complete - a.complete,
  );
}
