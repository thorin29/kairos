import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testGroupOf } from "@/lib/workouts/test-history";

/**
 * Monthly tests are measured against the last test (v0.707), not the last
 * time the move was done. The DB block runs against a disposable test Postgres
 * when DATABASE_URL is set.
 */
describe("testGroupOf", () => {
  it("knows the plank and Isometric's three holds, and nothing else", () => {
    expect(testGroupOf("Plank")).toEqual(["plank"]);
    expect(testGroupOf("wall sit")).toEqual(["wall sit", "dead hang", "push-up hold"]);
    expect(testGroupOf("Side plank")).toBeNull();
  });
});

let prisma: typeof import("@/lib/prisma").prisma;
let lastTestsFor: typeof import("@/lib/workouts/test-history").lastTestsFor;
let loadMovementLog: typeof import("@/lib/queries/workout-log").loadMovementLog;
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe.skipIf(!process.env.DATABASE_URL)("last test against the database", () => {
  let uid = "";
  const ids: Record<string, string> = {};
  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ lastTestsFor } = await import("@/lib/workouts/test-history"));
    ({ loadMovementLog } = await import("@/lib/queries/workout-log"));
  });
  beforeEach(async () => {
    await prisma.workoutSession.deleteMany();
    await prisma.user.deleteMany();
    uid = (await prisma.user.create({ data: { name: "Sam", kind: "CHILD" } })).id;
    for (const name of ["Plank", "Wall sit", "Dead hang", "Push-up hold"]) {
      const found = await prisma.poolExercise.findFirst({ where: { name } });
      ids[name] = (found ?? (await prisma.poolExercise.create({ data: { name, category: "ISOMETRIC", metric: "DURATION" } }))).id;
    }
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function day(iso: string, holds: Record<string, number[]>) {
    const s = await prisma.workoutSession.create({ data: { userId: uid, date: d(iso) } });
    for (const [name, secs] of Object.entries(holds)) {
      for (let i = 0; i < secs.length; i++) {
        await prisma.sessionSet.create({
          data: { sessionId: s.id, poolExerciseId: ids[name], setNumber: i + 1, seconds: secs[i], unit: "sec" },
        });
      }
    }
  }

  it("finds last month's test, not the regular workout since", async () => {
    await day("2026-10-05", { "Wall sit": [95], "Dead hang": [62], "Push-up hold": [48] }); // the test
    await day("2026-10-06", { Plank: [140] }); // the plank test
    await day("2026-11-03", { "Wall sit": [30, 30, 30], "Dead hang": [20, 20, 20], "Push-up hold": [20, 20, 20] });

    const t = await lastTestsFor(uid, [ids["Wall sit"], ids["Dead hang"], ids.Plank], d("2026-11-10"));
    expect(t.get(ids["Wall sit"])).toMatchObject({ date: "2026-10-05", sets: [{ seconds: 95 }] });
    expect(t.get(ids["Dead hang"])?.sets.map((s) => s.seconds)).toEqual([62]);
    expect(t.get(ids.Plank)).toMatchObject({ date: "2026-10-06", sets: [{ seconds: 140 }] });

    // The set logger: from the test card the hint is the test; otherwise the last time.
    const asTest = await loadMovementLog(uid, "2026-11-10", ids["Wall sit"], null, true);
    expect(asTest.last).toMatchObject({ date: "2026-10-05" });
    expect(asTest.last?.sets.map((s) => s.seconds)).toEqual([95]);
    const regular = await loadMovementLog(uid, "2026-11-10", ids["Wall sit"]);
    expect(regular.last?.date).toBe("2026-11-03");
  });

  it("has nothing when no earlier day looks like a test", async () => {
    await day("2026-11-03", { "Wall sit": [30, 30], "Dead hang": [20], "Push-up hold": [20, 20] });
    const t = await lastTestsFor(uid, [ids["Wall sit"]], d("2026-11-10"));
    expect(t.size).toBe(0);
  });
});
