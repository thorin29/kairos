import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { rebaselinePlan, type RebaselineUnit } from "@/lib/school/rebaseline";

/**
 * Re-baselining behind-schedule classes (v0.701). The rules are pure
 * (rebaseline.ts); the second block runs the real thing against a disposable
 * test Postgres when DATABASE_URL is set, and skips otherwise.
 *
 * 13 Nov 2026 is a Friday, so the next school day is Monday the 16th.
 */
const TODAY = "2026-11-13";
const FALL = [{ start: "2026-08-17", end: "2026-12-18" }];
const MF = [1, 2, 3, 4, 5];
const unit = (seq: number, date: string | null, more: Partial<RebaselineUnit> = {}): RebaselineUnit => ({
  id: `u${seq}`,
  seq,
  type: "ASSIGNMENT",
  load: 1,
  done: false,
  skipped: false,
  scheduledDate: date,
  ...more,
});
const opts = (more = {}) => ({
  today: TODAY,
  weekdays: MF,
  perDay: 1,
  fitToTerm: false,
  terms: FALL,
  holidays: new Set<string>(),
  ...more,
});

describe("rebaselinePlan", () => {
  it("restarts overdue, today's and future work from the next school day, oldest first", () => {
    const r = rebaselinePlan(
      [unit(3, "2026-11-13"), unit(1, "2026-11-11"), unit(2, "2026-11-12"), unit(4, "2026-11-16")],
      opts(),
    );
    expect(r.status).toBe("ready");
    expect(r.overdue).toBe(2);
    expect(r.currentFinish).toBe("2026-11-16");
    expect(r.moves).toEqual([
      { id: "u1", date: "2026-11-16" },
      { id: "u2", date: "2026-11-17" },
      { id: "u3", date: "2026-11-18" },
      { id: "u4", date: "2026-11-19" },
    ]);
    expect(r.newFinish).toBe("2026-11-19");
  });

  it("leaves done and excused units out, and skips no-school days", () => {
    const r = rebaselinePlan(
      [
        unit(0, "2026-11-10", { done: true }),
        unit(1, "2026-11-11"),
        unit(2, "2026-11-12", { skipped: true }),
        unit(3, "2026-11-16"),
      ],
      opts({ holidays: new Set(["2026-11-16"]) }),
    );
    expect(r.moves).toEqual([
      { id: "u1", date: "2026-11-17" },
      { id: "u3", date: "2026-11-18" },
    ]);
  });

  it("does nothing to a class with nothing overdue", () => {
    const r = rebaselinePlan([unit(1, "2026-11-13"), unit(2, "2026-11-16")], opts());
    expect(r.status).toBe("onSchedule");
    expect(r.moves).toEqual([]);
  });

  it("skips a class whose own pace would finish past its deadline", () => {
    const units = Array.from({ length: 40 }, (_, i) => unit(i, i === 0 ? "2026-11-12" : "2026-11-16"));
    const r = rebaselinePlan(units, opts());
    expect(r.status).toBe("pastDeadline");
    expect(r.deadline).toBe("2026-12-18");
    expect(r.newFinish! > "2026-12-18").toBe(true);
    expect(r.moves).toEqual([]);
  });

  it("re-fits a fit-to-term class to its deadline instead of skipping it", () => {
    const units = Array.from({ length: 40 }, (_, i) => unit(i, i === 0 ? "2026-11-12" : "2026-11-16"));
    const r = rebaselinePlan(units, opts({ fitToTerm: true }));
    expect(r.status).toBe("ready");
    expect(r.newFinish! <= "2026-12-18").toBe(true);
    expect(r.moves).toHaveLength(40);
    expect(r.moves[0].date).toBe("2026-11-16");
  });

  it("measures a whole-year class against the last term's end", () => {
    const units = Array.from({ length: 40 }, (_, i) => unit(i, i === 0 ? "2026-11-12" : "2026-11-16"));
    const r = rebaselinePlan(units, opts({ terms: [...FALL, { start: "2027-01-05", end: "2027-05-21" }] }));
    expect(r.status).toBe("ready");
    expect(r.deadline).toBe("2027-05-21");
    // The winter gap between terms isn't a school day.
    expect(r.moves.some((m) => m.date > "2026-12-18" && m.date < "2027-01-05")).toBe(false);
  });
});

let prisma: typeof import("@/lib/prisma").prisma;
let applyRebaseline: typeof import("@/lib/school/rebaseline-core").applyRebaseline;
let loadRebaselinePreview: typeof import("@/lib/school/rebaseline-core").loadRebaselinePreview;
let loadSchoolProgress: typeof import("@/lib/queries/school-card").loadSchoolProgress;
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : null);

async function plan(userId: string, termId: string, name: string, rows: { date: string; status?: string; done?: boolean }[]) {
  const cls = await prisma.schoolClass.create({ data: { name, userId, termId } });
  const p = await prisma.classPlan.create({ data: { classId: cls.id, status: "PUBLISHED" } });
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const task = await prisma.task.create({
      data: {
        userId,
        category: "SCHOOL",
        title: `${name} ${i + 1}`,
        dueDate: d(r.date),
        status: (r.status ?? "PENDING") as "PENDING",
        schoolWork: { create: { type: "ASSIGNMENT", classId: cls.id, startDate: d(r.date) } },
      },
      select: { schoolWork: { select: { id: true } } },
    });
    await prisma.classPlanUnit.create({
      data: {
        planId: p.id,
        seq: i,
        label: `${name} ${i + 1}`,
        done: r.done ?? false,
        scheduledDate: d(r.date),
        workId: task.schoolWork!.id,
      },
    });
  }
  return p.id;
}
async function unitsOf(planId: string) {
  return prisma.classPlanUnit.findMany({
    where: { planId },
    orderBy: { seq: "asc" },
    select: { done: true, scheduledDate: true, work: { select: { startDate: true, task: { select: { dueDate: true, originalDueDate: true } } } } },
  });
}

describe.skipIf(!process.env.DATABASE_URL)("re-baselining against the database", () => {
  let uid = "";
  let termId = "";
  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ applyRebaseline, loadRebaselinePreview } = await import("@/lib/school/rebaseline-core"));
    ({ loadSchoolProgress } = await import("@/lib/queries/school-card"));
  });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${TODAY}T14:00:00Z`));
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

  it("lists an on-schedule class that's set to finish late, locked", async () => {
    await plan(uid, termId, "Science", [{ date: "2026-11-13" }, { date: "2026-12-21" }]);
    const sam = (await loadRebaselinePreview()).find((s) => s.userId === uid)!;
    expect(sam.behind.map((c) => [c.className, c.status, c.overdue])).toEqual([["Science", "late", 0]]);
    expect(sam.overdue).toBe(0);
  });

  it("moves a behind class, keeps where each item was first planned, and leaves a late class alone", async () => {
    const behind = await plan(uid, termId, "Grammar", [
      { date: "2026-11-10", status: "COMPLETE" }, // done on the card, flag never caught up
      { date: "2026-11-11" },
      { date: "2026-11-12" },
      { date: "2026-11-13" },
      { date: "2026-11-16" },
    ]);
    const late = await plan(
      uid,
      termId,
      "Geography",
      Array.from({ length: 40 }, (_, i) => ({ date: i === 0 ? "2026-11-12" : "2026-12-18" })),
    );

    const preview = await loadRebaselinePreview();
    const sam = preview.find((s) => s.userId === uid)!;
    expect(sam.behind.map((c) => [c.className, c.status])).toEqual([
      ["Geography", "pastDeadline"],
      ["Grammar", "ready"],
    ]);
    expect(sam.overdue).toBe(2);
    expect(sam.firstDate).toBe("2026-11-16");

    const res = await applyRebaseline(uid);
    expect(res).toMatchObject({ classes: 1, items: 4 });

    const g = await unitsOf(behind);
    expect(g[0].done).toBe(true);
    expect(g.slice(1).map((u) => iso(u.scheduledDate))).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(g.slice(1).map((u) => iso(u.work!.task.dueDate))).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(g.slice(1).map((u) => iso(u.work!.startDate))).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(g.slice(1).map((u) => iso(u.work!.task.originalDueDate))).toEqual(["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16"]);

    const geo = await unitsOf(late);
    expect(iso(geo[0].scheduledDate)).toBe("2026-11-12");
    expect(iso(geo[0].work!.task.dueDate)).toBe("2026-11-12");

    // The moved class stops saying "falling behind"; the late one still does.
    const pace = Object.fromEntries((await loadSchoolProgress(uid)).progress.map((p) => [p.className, p.pace]));
    expect(pace).toEqual({ Grammar: null, Geography: "behind" });

    // Run again: nothing is overdue now, so nothing moves.
    expect(await applyRebaseline(null)).toMatchObject({ classes: 0, items: 0 });
  });
});
