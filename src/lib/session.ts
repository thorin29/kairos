import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting, clearSetting } from "@/lib/settings";
import { hashPin, verifyPin } from "@/lib/auth";

const COOKIE = "fd_admin";
const UNLOCK_HOURS = 8;
const SECRET_KEY = "sessionSecret";
const ADMIN_PIN_KEY = "adminPinHash";
// Mirror of gate.ts's REQUIRE_LOGIN key. Read directly here (rather than
// importing from gate.ts) because gate.ts imports from this module.
const REQUIRE_LOGIN_KEY = "requireLogin";

/**
 * There is no per-person sign-in. The dashboard is a shared household screen:
 * everyone sees everything and checks off their own work without identifying
 * themselves, which is the whole point of a wall tablet.
 *
 * The only thing behind a lock is administration. A single shared PIN guards
 * it — any admin uses the same PIN — and the PIN is optional: with none set,
 * admin is simply open. An unlock lasts a few hours, then lapses on its own so
 * an unattended tablet doesn't stay open.
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

/** The shared admin PIN hash, or null when admin isn't gated. */
async function adminPinHash(): Promise<string | null> {
  return getSetting(ADMIN_PIN_KEY);
}

export async function adminPinSet(): Promise<boolean> {
  return (await adminPinHash()) !== null;
}

/** Start (or refresh) an unlock. The session isn't tied to a person — the PIN
 *  is shared — so the cookie carries only an expiry and its signature. */
export async function startAdminSession(): Promise<void> {
  const expires = Date.now() + UNLOCK_HOURS * 3_600_000;
  const payload = String(expires);

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

async function hasValidUnlockCookie(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return false;

  const parts = raw.split(".");
  if (parts.length !== 2) return false;

  const [expires, signature] = parts;
  if (!safeEqual(signature, sign(expires, await secret()))) return false;
  if (Number(expires) < Date.now()) return false;
  return true;
}

export async function isAdmin(): Promise<boolean> {
  if (!(await adminPinSet())) {
    // No PIN set. On a private LAN tablet that means admin is open, as it
    // always has been. But if the install is public (sign-in required), don't
    // fall open — refuse admin rather than handing it to everyone who's signed
    // in. The toggle below won't let sign-in be turned on without a PIN, so in
    // practice this is belt-and-suspenders for a hand-edited setting.
    return (await getSetting(REQUIRE_LOGIN_KEY)) !== "true";
  }
  return hasValidUnlockCookie();
}

export type AdminUser = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
};

/** A representative admin for display. With a shared PIN there's no single
 *  "who unlocked", so this is the first admin (or, failing that, the first
 *  person) — enough to label the admin area. */
async function representativeAdmin(): Promise<AdminUser | null> {
  const first =
    (await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.user.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    }));
  if (!first) return null;
  return {
    id: first.id,
    name: first.displayName ?? first.name,
    color: first.color,
    avatarPath: first.avatarPath,
  };
}

/** A representative admin when admin is unlocked (or open), else null. */
export async function currentAdmin(): Promise<AdminUser | null> {
  if (!(await isAdmin())) return null;
  return representativeAdmin();
}

/**
 * Guard for actions only an admin may take. Throwing rather than returning an
 * error keeps callers honest: forgetting the check makes the action impossible
 * to run, not silently open.
 */
export async function requireAdmin(): Promise<AdminUser> {
  if (!(await isAdmin())) {
    throw new Error("That's a parent-only action. Unlock admin first.");
  }
  const admin = await representativeAdmin();
  if (!admin) throw new Error("No admin account exists yet.");
  return admin;
}

/** Check a PIN against the shared admin PIN. */
export async function verifyAdminPin(pin: string): Promise<boolean> {
  const hash = await adminPinHash();
  if (!hash) return false;
  return verifyPin(pin, hash);
}

/** Set (or change) the shared admin PIN. */
export async function saveAdminPin(pin: string): Promise<void> {
  await setSetting(ADMIN_PIN_KEY, hashPin(pin));
}

/** Remove the shared admin PIN and end the current unlock. */
export async function clearAdminPin(): Promise<void> {
  await clearSetting(ADMIN_PIN_KEY);
  await endAdminSession();
}
