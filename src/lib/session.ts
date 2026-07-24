import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE = "fd_session";
const MAX_AGE_DAYS = 30;
const SECRET_KEY = "sessionSecret";

/**
 * Sessions are a signed cookie rather than a database table. There are six
 * people on a home network; a stored session table would be machinery for
 * nothing. The signing secret is generated once and kept in AppSetting, so
 * there's no environment variable to set and cookies survive a restart.
 */
async function secret(): Promise<string> {
  const existing = await prisma.appSetting.findUnique({
    where: { key: SECRET_KEY },
  });
  if (existing) return existing.value;

  const value = randomBytes(32).toString("hex");
  const row = await prisma.appSetting.upsert({
    where: { key: SECRET_KEY },
    update: {},
    create: { key: SECRET_KEY, value },
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

export type CurrentUser = {
  id: string;
  name: string;
  displayName: string | null;
  color: string;
  avatarPath: string | null;
  isAdmin: boolean;
};

export async function startSession(userId: string): Promise<void> {
  const key = await secret();
  const expires = Date.now() + MAX_AGE_DAYS * 86_400_000;
  const payload = `${userId}.${expires}`;

  const store = await cookies();
  store.set(COOKIE, `${payload}.${sign(payload, key)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_DAYS * 86_400,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
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
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    color: user.color,
    avatarPath: user.avatarPath,
    isAdmin: user.role === "ADMIN",
  };
}

export async function isAdmin(): Promise<boolean> {
  return (await getCurrentUser())?.isAdmin ?? false;
}

/**
 * Guard for actions only a parent may take. Throwing rather than returning
 * an error keeps every caller honest: forgetting to check is impossible if
 * the action can't run without it.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    throw new Error("That's a parent-only action. Switch profiles first.");
  }
  return user;
}

/** Self or a parent — used for editing a profile or adding someone's task. */
export async function canActFor(userId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.isAdmin || user.id === userId;
}
