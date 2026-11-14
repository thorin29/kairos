import "server-only";
// Last month's test result (v0.707). A monthly test (the plank, or Isometric's
// wall sit, dead hang and push-up hold) should be measured against the last
// TEST, not against the last time the move was done: the three holds are also
// in the regular Isometric workouts, where they're shorter sets.
//
// Tests aren't tagged when they're logged, so a test day is recognised by its
// shape: every hold in the test logged with exactly one set (the test is one
// max hold each; the regular workouts do 2–3 sets of them).
import { prisma } from "@/lib/prisma";
import { fromDateColumn } from "@/lib/dates";
import { ISO_TEST, PLANK_TEST } from "@/lib/workouts/core-library";

const GROUPS: readonly (readonly string[])[] = [
  [PLANK_TEST.name.toLowerCase()],
  ISO_TEST.map((m) => m.name.toLowerCase()),
];

/** The test a movement belongs to (its group's names, lowercase), or null. */
export function testGroupOf(name: string): readonly string[] | null {
  const n = name.trim().toLowerCase();
  return GROUPS.find((g) => g.includes(n)) ?? null;
}

export type LastTest = {
  date: string;
  sets: { weight: number | null; reps: number | null; seconds: number | null; unit: string | null }[];
};

/**
 * For each of `poolIds` that's a test movement: its sets on the most recent
 * test day before `before`. Movements that aren't in a test, or have no
 * earlier test, are left out.
 */
export async function lastTestsFor(userId: string, poolIds: string[], before: Date): Promise<Map<string, LastTest>> {
  const out = new Map<string, LastTest>();
  if (poolIds.length === 0) return out;
  const asked = (await prisma.poolExercise.findMany({
    where: { id: { in: poolIds } },
    select: { id: true, name: true },
  })) as { id: string; name: string }[];
  const groups = [...new Set(asked.map((p) => testGroupOf(p.name)).filter((g): g is readonly string[] => g != null))];
  if (groups.length === 0) return out;

  for (const group of groups) {
    const members = (await prisma.poolExercise.findMany({
      where: { OR: group.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })) },
      select: { id: true, name: true },
    })) as { id: string; name: string }[];
    const nameOf = new Map(members.map((m) => [m.id, m.name.trim().toLowerCase()]));
    const sets = (await prisma.sessionSet.findMany({
      where: { poolExerciseId: { in: members.map((m) => m.id) }, session: { userId, isRest: false, date: { lt: before } } },
      orderBy: [{ setNumber: "asc" }, { createdAt: "asc" }],
      select: {
        poolExerciseId: true,
        weight: true,
        reps: true,
        seconds: true,
        unit: true,
        session: { select: { date: true } },
      },
    })) as {
      poolExerciseId: string;
      weight: number | null;
      reps: number | null;
      seconds: number | null;
      unit: string | null;
      session: { date: Date };
    }[];

    // Per day, the sets of each hold in the test.
    const byDay = new Map<string, Map<string, typeof sets>>();
    for (const s of sets) {
      const day = fromDateColumn(s.session.date);
      const name = nameOf.get(s.poolExerciseId) ?? "";
      const m = byDay.get(day) ?? new Map<string, typeof sets>();
      m.set(name, [...(m.get(name) ?? []), s]);
      byDay.set(day, m);
    }
    const testDay = [...byDay.keys()]
      .sort()
      .reverse()
      .find((d) => group.every((n) => byDay.get(d)!.get(n)?.length === 1));
    if (!testDay) continue;

    const day = byDay.get(testDay)!;
    for (const p of asked) {
      const n = p.name.trim().toLowerCase();
      if (!group.includes(n)) continue;
      const rows = day.get(n) ?? [];
      out.set(p.id, {
        date: testDay,
        sets: rows.map((r) => ({ weight: r.weight, reps: r.reps, seconds: r.seconds, unit: r.unit })),
      });
    }
  }
  return out;
}
