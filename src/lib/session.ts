import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE = "fd_admin";
const UNLOCK_HOURS = 8;
const SECRET_KEY = "sessionSecret";

/**
 * There is no per-person sign-in. The dashboard is a shared household
 * screen: everyone sees everything and checks off their own work without
 * identifying themselves, which is the whole point of a wall tablet.
 *
 * The only thing behind a lock is administration — the chore schedule,
 * reading plans, the household list. A parent enters their PIN once and the
 * unlock lasts a few hours, then lapses on its own so an unattended tablet
 * doesn't stay open.
 */
async function secret(): Promise<string> {
  const existing = await prisma.appSetting.findUnique({
    where: { key: SECRET_KEY },
  });
  if (existing) return existing.value;

  const row = await prisma.appSetting.upsert({
    where: { key: SECRET_KEY },
    update: {},
    create: { key: SECRET_KEY, value: randomBytes(32).toString("hex") },
  });
  return row.value;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function startAdminSession(userId: string): Promise<void> {
  const expires = Date.now() + UNLOCK_HOURS * 3_600_000;
  const payload = `${userId}.${expires}`;

  const store = await cookies();
  store.set(COOKIE, `${payload}.${sign(payload, await secret())}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: UNLOCK_HOURS * 3600,
  });
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export type AdminUser = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
};

/** The parent who unlocked, or null if the lock is on. */
export async function currentAdmin(): Promise<AdminUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  const [userId, expires, signature] = parts;
  if (!safeEqual(signature, sign(`${userId}.${expires}`, await secret()))) {
    return null;
  }
  if (Number(expires) < Date.now()) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive || user.role !== "ADMIN") return null;

  return {
    id: user.id,
    name: user.displayName ?? user.name,
    color: user.color,
    avatarPath: user.avatarPath,
  };
}

export async function isAdmin(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}

/**
 * Guard for actions only a parent may take. Throwing rather than returning
 * an error keeps callers honest: forgetting the check makes the action
 * impossible to run, not silently open.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin) {
    throw new Error("That's a parent-only action. Unlock admin first.");
  }
  return admin;
}
