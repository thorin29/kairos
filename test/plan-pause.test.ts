import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { nextClassDay } from "@/lib/school/plan-pause";

/**
 * Paused classes (v0.702): one open item at a time that never goes late, the
 * next one after each is finished, and Resume lays the rest out again. The DB
 * block runs against a disposable test Postgres when DATABASE_URL is set.
 *
 * 13 Nov 2026 is a Friday.
 */
describe("nextClassDay", () => {
  it("finds the next meeting day, skipping weekends and no-school days", () => {
    expect(nextClassDay("2026-11-13", [1, 2, 3, 4, 5], new Set())).toBe("2026-11-13");
    expect(nextClassDay("2026-11-14", [1, 2, 3, 4, 5], new Set())).toBe("2026-11-16");
    expect(nextClassDay("2026-11-14", [1, 2, 3, 4, 5], new Set(["2026-11-16"]))).toBe("2026-11-17");
    expect(nextClassDay("2026-11-13", [1, 2, 3, 4], new Set())).toBe("2026-11-16");
  });
});

let prisma: typeof import("@/lib/prisma").prisma;
let ensurePausedNext: typeof import("@/lib/school/plan-pause").ensurePausedNext;
let rollPausedPlans: typeof import("@/lib/school/plan-pause").rollPausedPlans;
let resetPausedRoll: typeof import("@/lib/school/plan-pause").resetPausedRoll;
let syncPlanUnitDone: typeof import("@/lib/school/plan-unit-sync").syncPlanUnitDone;
let resumePlanSchedule: typeof import("@/lib/school/rebaseline-core").resumePlanSchedule;
let loadRebaselinePreview: typeof import("@/lib/school/rebaseline-core").loadRebaselinePreview;

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : null);
const at = (day: string) => vi.setSystemTime(new Date(`${day}T14:00:00Z`));

async function makePlan(userId: string, termId: string, dates: string[]) {
  const cls = await prisma.schoolClass.create({ data: { name: "Writing", userId, termId } });
  const p = await prisma.classPlan.create({ data: { classId: cls.id, status: "PUBLISHED" } });
  for (let i = 0; i < dates.length; i++) {
    const task = await prisma.task.create({
      data: {
        userId,
        category: "SCHOOL",
        title: `Lesson ${i + 1}`,
        dueDate: d(dates[i]),
        schoolWork: { create: { type: "ASSIGNMENT", classId: cls.id, startDate: d(dates[i]) } },
      },
      select: { id: true, schoolWork: { select: { id: true } } },
    });
    await prisma.classPlanUnit.create({
      data: { planId: p.id, seq: i, label: `Lesson ${i + 1}`, scheduledDate: d(dates[i]), workId: task.schoolWork!.id },
    });
  }
  return p.id;
}
async function openTasks(userId: string) {
  const rows = await prisma.task.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { title: "asc" },
    select: { id: true, title: true, dueDate: true },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, due: iso(r.dueDate) }));
}
async function complete(taskId: string) {
  await prisma.task.update({ where: { id: taskId }, data: { status: "COMPLETE", completedAt: new Date() } });
  await syncPlanUnitDone(taskId, true);
}

describe.skipIf(!process.env.DATABASE_URL)("paused classes against the database", () => {
  let uid = "";
  let termId = "";
  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ ensurePausedNext, rollPausedPlans, resetPausedRoll } = await import("@/lib/school/plan-pause"));
    ({ syncPlanUnitDone } = await import("@/lib/school/plan-unit-sync"));
    ({ resumePlanSchedule, loadRebaselinePreview } = await import("@/lib/school/rebaseline-core"));
  });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at("2026-11-13");
    resetPausedRoll();
    await prisma.task.deleteMany();
    await prisma.schoolClass.deleteMany();
    await prisma.term.deleteMany();
    await prisma.event.deleteMany({ where: { kind: "PAUSE" } });
    await prisma.schoolBreak.deleteMany();
    await prisma.user.deleteMany();
    uid = (await prisma.user.create({ data: { name: "Sam", kind: "CHILD" } })).id;
    termId = (await prisma.term.create({ data: { name: "Fall", startDate: d("2026-08-17"), endDate: d("2026-12-18") } })).id;
  });
  afterAll(async () => {
    vi.useRealTimers();
    await prisma.$disconnect();
  });

  it("keeps one open item that never goes late, and brings the next as each is done", async () => {
    // Two overdue, today's, and two ahead.
    const planId = await makePlan(uid, termId, ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17"]);
    await prisma.classPlan.update({ where: { id: planId }, data: { paused: true } });
    await ensurePausedNext(planId, { createFrom: "2026-11-13", pullIn: true });

    let open = await openTasks(uid);
    expect(open).toEqual([{ id: open[0].id, title: "Lesson 1", due: "2026-11-13" }]);
    expect((await loadRebaselinePreview()).flatMap((s) => s.behind)).toEqual([]);

    // Done today: the next one is due Monday, and can be pulled in to do more.
    await complete(open[0].id);
    open = await openTasks(uid);
    expect(open.map((t) => [t.title, t.due])).toEqual([["Lesson 2", "2026-11-16"]]);

    // Not done by Wednesday: it rolls to today instead of going late.
    at("2026-11-18");
    await rollPausedPlans();
    open = await openTasks(uid);
    expect(open.map((t) => [t.title, t.due])).toEqual([["Lesson 2", "2026-11-18"]]);

    // Reopening Lesson 1 makes it the one open item again.
    const l1 = await prisma.task.findFirst({ where: { userId: uid, title: "Lesson 1" } });
    await prisma.task.update({ where: { id: l1!.id }, data: { status: "PENDING", completedAt: null } });
    await syncPlanUnitDone(l1!.id, false);
    open = await openTasks(uid);
    expect(open.map((t) => t.title)).toEqual(["Lesson 1"]);
  });

  it("resume lays out everything left from the next school day", async () => {
    const planId = await makePlan(uid, termId, ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16"]);
    await prisma.classPlan.update({ where: { id: planId }, data: { paused: true } });
    await ensurePausedNext(planId, { createFrom: "2026-11-13", pullIn: true });
    await prisma.classPlan.update({ where: { id: planId }, data: { paused: false } });
    await resumePlanSchedule(planId);

    const open = await openTasks(uid);
    expect(open.map((t) => [t.title, t.due])).toEqual([
      ["Lesson 1", "2026-11-16"],
      ["Lesson 2", "2026-11-17"],
      ["Lesson 3", "2026-11-18"],
      ["Lesson 4", "2026-11-19"],
    ]);
    const units = await prisma.classPlanUnit.findMany({ where: { planId }, orderBy: { seq: "asc" } });
    expect(units.map((u) => iso(u.scheduledDate))).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
  });
});
