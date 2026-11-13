import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword, hashPin } from "@/lib/auth";

/**
 * The web sign-in gate (v0.699) against a real database. Runs only with
 * DATABASE_URL (a disposable test Postgres, migrations applied); skips otherwise.
 */
type Gate = typeof import("@/lib/web-gate");
let gate: Gate;
let prisma: typeof import("@/lib/prisma").prisma;

async function sessionFor(userId: string, opts: { days?: number; version?: number } = {}) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { credentialVersion: true } });
  const expires = Date.now() + (opts.days ?? 1) * 86_400_000;
  return gate.signUserSession(`${userId}.${expires}.${opts.version ?? u.credentialVersion}`);
}

describe.skipIf(!process.env.DATABASE_URL)("web sign-in gate (v0.699)", () => {
  beforeAll(async () => {
    gate = await import("@/lib/web-gate");
    ({ prisma } = await import("@/lib/prisma"));
  });
  beforeEach(async () => {
    await prisma.task.deleteMany();
    await prisma.companion.deleteMany();
    await prisma.device.deleteMany();
    await prisma.user.deleteMany();
    await prisma.appSetting.deleteMany({ where: { key: "adminPinHash" } });
    gate.resetWebGateCache();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("is open on first run, until an admin has a password", async () => {
    await prisma.user.create({ data: { name: "Alex", role: "ADMIN" } }); // no password yet
    await prisma.user.create({ data: { name: "Sam", role: "MEMBER", passwordHash: hashPassword("password1") } });
    expect(await gate.webBootstrapOpen()).toBe(true);
    await prisma.user.updateMany({ where: { name: "Alex" }, data: { passwordHash: hashPassword("password1") } });
    gate.resetWebGateCache();
    expect(await gate.webBootstrapOpen()).toBe(false);
  });

  it("accepts only a parent's session, signed, current and unexpired", async () => {
    const admin = await prisma.user.create({ data: { name: "Alex", role: "ADMIN", passwordHash: hashPassword("password1") } });
    const kid = await prisma.user.create({ data: { name: "Sam", role: "MEMBER", passwordHash: hashPassword("password1") } });
    expect((await gate.webSessionUser(await sessionFor(admin.id)))?.id).toBe(admin.id);
    expect(await gate.webSessionUser(await sessionFor(kid.id))).toBeNull(); // children use the app
    expect(await gate.webSessionUser(await sessionFor(admin.id, { days: -1 }))).toBeNull(); // expired
    expect(await gate.webSessionUser(await sessionFor(admin.id, { version: 99 }))).toBeNull(); // password changed
    const good = await sessionFor(admin.id);
    expect(await gate.webSessionUser(good.slice(0, -2) + "00")).toBeNull(); // tampered
    expect(await gate.webSessionUser(undefined)).toBeNull();
    await prisma.user.update({ where: { id: admin.id }, data: { isActive: false } });
    expect(await gate.webSessionUser(good)).toBeNull(); // deactivated
  });

  it("ties an admin unlock to the current PIN", async () => {
    await prisma.appSetting.upsert({ where: { key: "adminPinHash" }, create: { key: "adminPinHash", value: hashPin("1234") }, update: { value: hashPin("1234") } });
    const unlock = await gate.signAdminUnlock(String(Date.now() + 60_000));
    expect(await gate.adminUnlockValid(unlock)).toBe(true);
    expect(await gate.adminUnlockValid(await gate.signAdminUnlock(String(Date.now() - 1)))).toBe(false); // lapsed
    await prisma.appSetting.update({ where: { key: "adminPinHash" }, data: { value: hashPin("5678") } });
    expect(await gate.adminUnlockValid(unlock)).toBe(false); // PIN changed: every old unlock ends
  });
});
