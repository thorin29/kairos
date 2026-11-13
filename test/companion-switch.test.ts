import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANIONS } from "@/lib/companions";
// The database modules load only when this runs (no DATABASE_URL, no generated
// client needed to skip it).
let prisma: typeof import("@/lib/prisma").prisma;
let activateCompanionCore: typeof import("@/lib/companions-tenure").activateCompanionCore;
let loadProgression: typeof import("@/lib/queries/progression").loadProgression;

/**
 * Switching characters keeps growth with the one that earned it (v0.697),
 * against a real database: runs only when DATABASE_URL points at a disposable
 * test Postgres (with migrations applied), and skips otherwise.
 *
 * 14:00Z and 20:00Z are the same household day in UTC and US time zones.
 */
const [A, B] = Object.keys(COMPANIONS);
const at = (iso: string, hh = "14") => vi.setSystemTime(new Date(`${iso}T${hh}:00:00Z`));
let uid = "";

async function chores(iso: string, done: number, of = 2) {
  for (let i = 0; i < of; i++) {
    await prisma.task.create({
      data: {
        userId: uid,
        category: "CHORE",
        title: `chore ${iso} ${i} ${Math.random()}`,
        dueDate: new Date(`${iso}T00:00:00Z`),
        status: i < done ? "COMPLETE" : "PENDING",
        completedAt: i < done ? new Date() : null,
      },
    });
  }
}
async function completeOne(iso: string) {
  const t = await prisma.task.findFirst({ where: { userId: uid, dueDate: new Date(`${iso}T00:00:00Z`), status: "PENDING" } });
  await prisma.task.update({ where: { id: t!.id }, data: { status: "COMPLETE", completedAt: new Date() } });
}
async function companion() {
  return (await loadProgression()).find((p) => p.id === uid)!.companion;
}
async function swap(to: string) {
  const r = await activateCompanionCore(uid, to);
  expect(r.error).toBeNull();
}
async function start(withB = true) {
  at("2026-11-02", "08");
  await prisma.companion.create({ data: { userId: uid, species: A, isActive: true, tenureStartedAt: new Date() } });
  if (withB) await prisma.companion.create({ data: { userId: uid, species: B, isActive: false, mintedStage: 0 } });
}

describe.skipIf(!process.env.DATABASE_URL)("switching characters (v0.697)", () => {
  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ activateCompanionCore } = await import("@/lib/companions-tenure"));
    ({ loadProgression } = await import("@/lib/queries/progression"));
  });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await prisma.task.deleteMany();
    await prisma.companion.deleteMany();
    await prisma.companionState.deleteMany();
    await prisma.user.deleteMany();
    uid = (await prisma.user.create({ data: { name: "Sam", kind: "CHILD" } })).id;
  });
  afterAll(async () => {
    vi.useRealTimers();
    await prisma.$disconnect();
  });

  it("away and back the same day changes nothing", async () => {
    await start();
    for (const d of ["2026-11-02", "2026-11-03", "2026-11-04"]) await chores(d, 2);
    at("2026-11-05");
    await chores("2026-11-05", 2);
    expect((await companion()).growth).toBe(4);
    await swap(B);
    expect((await companion()).growth).toBe(0);
    at("2026-11-05", "20");
    await swap(A);
    expect((await companion()).growth).toBe(4);
  });

  it("keeps parts of a square (growthBanked was an integer)", async () => {
    await start();
    await chores("2026-11-02", 2);
    await chores("2026-11-03", 1);
    await chores("2026-11-04", 1, 3);
    at("2026-11-05");
    const before = (await companion()).growth; // 1 + 1/2 + 1/3
    expect(before).toBeCloseTo(1.8333, 3);
    await swap(B);
    at("2026-11-05", "20");
    await swap(A);
    expect((await companion()).growth).toBeCloseTo(before, 9);
  });

  it("a just-hatched character keeps its hatch day when switched out that evening", async () => {
    await start();
    await chores("2026-11-02", 2);
    at("2026-11-02", "20");
    expect((await companion()).growth).toBe(1);
    await swap(B);
    expect((await companion()).growth).toBe(0); // B didn't do today's work
    at("2026-11-03");
    await chores("2026-11-03", 2);
    expect((await companion()).growth).toBe(1); // B earns tomorrow
    await swap(A);
    expect((await companion()).growth).toBe(1); // A: its hatch day; tomorrow so far was B's
    at("2026-11-04");
    await chores("2026-11-04", 2);
    expect((await companion()).growth).toBe(2);
  });

  it("splits a day at the switch: before stays, after goes to the new one", async () => {
    await start();
    at("2026-11-03");
    await chores("2026-11-03", 1, 2); // A has half the day
    await swap(B);
    await completeOne("2026-11-03"); // the other half, done for B
    expect((await companion()).growth).toBeCloseTo(0.5, 9);
    at("2026-11-03", "20");
    await swap(A);
    expect((await companion()).growth).toBeCloseTo(0.5, 9);
    at("2026-11-04");
    await swap(B);
    expect((await companion()).growth).toBeCloseTo(0.5, 9);
  });

  it("never goes negative when the day's list grows after a switch", async () => {
    await start();
    at("2026-11-03");
    await chores("2026-11-03", 1, 1); // A: the whole day so far
    await swap(B);
    await chores("2026-11-03", 0, 1); // a new chore lands: the day is now half done
    expect((await companion()).growth).toBe(0);
  });

  it("deepening resumes where it left off", async () => {
    at("2026-11-02", "08");
    await prisma.companion.create({
      data: { userId: uid, species: A, isActive: true, tenureStartedAt: new Date(), growthBanked: 12, mintedStage: 2, deepeningStartedAt: new Date() },
    });
    await prisma.companion.create({ data: { userId: uid, species: B, isActive: false, mintedStage: 0 } });
    for (const d of ["2026-11-02", "2026-11-03", "2026-11-04"]) await chores(d, 2);
    at("2026-11-05");
    let c = await companion();
    expect(c.phase).toBe("deepening");
    expect(c.phaseProgress).toBe(3);
    await swap(B);
    at("2026-11-05", "20");
    await swap(A);
    c = await companion();
    expect(c.phase).toBe("deepening");
    expect(c.phaseProgress).toBe(3);
    expect(c.growth).toBe(15);
    at("2026-11-06");
    await chores("2026-11-06", 2);
    expect((await companion()).phaseProgress).toBe(4);
  });
});
