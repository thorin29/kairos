import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appSecret } from "@/lib/secret";
import { getSetting } from "@/lib/settings";

/**
 * The web's sign-in gate (v0.699), one implementation for proxy.ts (Node
 * runtime, every request; middleware.ts before v0.700) and the app code (currentUser, isAdmin).
 *
 * - Sign-in is required everywhere on the web. There is no switch; it doesn't
 *   depend on REQUIRE_LOGIN or SESSION_SECRET (the secret comes from appSecret,
 *   DB-backed unless SESSION_SECRET overrides it).
 * - Only an ADMIN account may hold a web session. The shared screen is signed
 *   in by a parent and then acts for the household exactly as before; children
 *   use the phone app (device tokens, /api/v1, untouched).
 * - First run: until some active admin has a password there is no one to sign
 *   in as, so the gate stays open (`webBootstrapOpen`) for setup.
 * - The admin unlock cookie is signed with a key that includes the PIN hash, so
 *   changing (or clearing) the PIN ends every other device's unlock.
 */

export const USER_COOKIE = "fd_user";
export const ADMIN_COOKIE = "fd_admin";
const ADMIN_PIN_KEY = "adminPinHash";

function hmac(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// --- first run --------------------------------------------------------------

let bootCache: { at: number; open: boolean } | null = null;
const BOOT_TTL_MS = 15_000;

/** True while no active admin has a password (a fresh install). Cached briefly:
 *  proxy.ts asks on every request. Once closed it stays closed for good in
 *  this process, so removing the last admin password can't reopen the site
 *  until a restart (and then only if it's really true). */
export async function webBootstrapOpen(): Promise<boolean> {
  const now = Date.now();
  if (bootCache && (!bootCache.open || now - bootCache.at < BOOT_TTL_MS)) return bootCache.open;
  const n = await prisma.user.count({
    where: { role: "ADMIN", isActive: true, passwordHash: { not: null } },
  });
  bootCache = { at: now, open: n === 0 };
  return bootCache.open;
}

/** Tests only: forget the cached first-run answer. */
export function resetWebGateCache(): void {
  bootCache = null;
}

// --- the signed-in person ---------------------------------------------------

export type WebUser = {
  id: string;
  name: string;
  displayName: string | null;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
  role: "ADMIN" | "MEMBER";
};

/** Sign a session payload (`userId.expires.credentialVersion`). */
export async function signUserSession(payload: string): Promise<string> {
  return `${payload}.${hmac(payload, await appSecret())}`;
}

/** The person a web session cookie belongs to, or null. Checks the signature,
 *  the expiry, that the person is active with a password and the same
 *  credential version, and that they are an admin (web sign-in is for parents). */
export async function webSessionUser(raw: string | undefined | null): Promise<WebUser | null> {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [userId, expires, version, signature] = parts;
  const payload = `${userId}.${expires}.${version}`;
  if (!safeEqual(signature, hmac(payload, await appSecret()))) return null;
  if (!(Number(expires) > Date.now())) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      avatarPath: true,
      avatarPosition: true,
      role: true,
      isActive: true,
      passwordHash: true,
      credentialVersion: true,
    },
  });
  if (!user || !user.isActive || !user.passwordHash) return null;
  if (user.credentialVersion !== Number(version)) return null;
  if (user.role !== "ADMIN") return null;
  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    color: user.color,
    avatarPath: user.avatarPath,
    avatarPosition: user.avatarPosition,
    role: user.role,
  };
}

// --- the admin unlock -------------------------------------------------------

/** The admin PIN hash, or null when no PIN is set. */
export async function adminPinHashSetting(): Promise<string | null> {
  return getSetting(ADMIN_PIN_KEY);
}

async function unlockKey(): Promise<string> {
  return `${await appSecret()}:${(await adminPinHashSetting()) ?? ""}`;
}

/** Sign an unlock expiry (the cookie is `expires.signature`). */
export async function signAdminUnlock(expires: string): Promise<string> {
  return `${expires}.${hmac(expires, await unlockKey())}`;
}

/** A current unlock: signed with today's PIN and not expired. */
export async function adminUnlockValid(raw: string | undefined | null): Promise<boolean> {
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 2) return false;
  const [expires, signature] = parts;
  if (!safeEqual(signature, hmac(expires, await unlockKey()))) return false;
  return Number(expires) > Date.now();
}
