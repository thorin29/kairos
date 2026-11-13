import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting, clearSetting } from "@/lib/settings";
import { hashPin, verifyPin } from "@/lib/auth";
import { cookieSecure } from "@/lib/cookie-flags";
import { ADMIN_COOKIE, adminUnlockValid, signAdminUnlock, webBootstrapOpen, webSessionUser, USER_COOKIE } from "@/lib/web-gate";

const COOKIE = ADMIN_COOKIE;
const ADMIN_IDLE_KEY = "adminIdleMinutes";
/** Auto-lock choices, minutes with no admin activity (v0.696, Admin → Settings
 *  → Device). 240 keeps the old four hours, now counted from the last use. */
export const ADMIN_IDLE_CHOICES = [5, 15, 30, 60, 240] as const;
const DEFAULT_IDLE_MINUTES = 240;
const ADMIN_PIN_KEY = "adminPinHash";

/**
 * The web requires a parent's sign-in everywhere (v0.699, web-gate.ts); the
 * shared screen then acts for the household. On top of that, administration
 * sits behind a single shared PIN, a nuisance guard so others don't change
 * settings, not a security boundary. The PIN is optional: with none set, a
 * signed-in parent is simply admin. An unlock lapses after a set time with no admin
 * activity (`adminIdleMinutes`), so an unattended tablet doesn't stay open.
 * Each admin page opened, and taps on one, push the time back
 * (`touchAdminSession`, from AdminIdleLock in the admin layout).
 */
/** The shared admin PIN hash, or null when admin isn't gated. */
async function adminPinHash(): Promise<string | null> {
  return getSetting(ADMIN_PIN_KEY);
}

export async function adminPinSet(): Promise<boolean> {
  return (await adminPinHash()) !== null;
}

/** Minutes of no admin activity before the unlock lapses. */
export async function adminIdleMinutes(): Promise<number> {
  const n = Number(await getSetting(ADMIN_IDLE_KEY));
  return (ADMIN_IDLE_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_IDLE_MINUTES;
}

export async function setAdminIdleMinutes(minutes: number): Promise<void> {
  if (!(ADMIN_IDLE_CHOICES as readonly number[]).includes(minutes)) throw new Error("Not a choice.");
  await setSetting(ADMIN_IDLE_KEY, String(minutes));
}

/** Start (or refresh) an unlock. The session isn't tied to a person — the PIN
 *  is shared — so the cookie carries only an expiry and its signature (the
 *  format the edge check in middleware.ts reads). Returns the expiry. */
export async function startAdminSession(): Promise<number> {
  const minutes = await adminIdleMinutes();
  const expires = Date.now() + minutes * 60_000;
  const store = await cookies();
  // Signed with a key that includes the PIN hash (web-gate.ts), so changing
  // the PIN ends every other device's unlock.
  store.set(COOKIE, await signAdminUnlock(String(expires)), {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: minutes * 60,
  });
  return expires;
}

/** Admin activity: push a current unlock's expiry back by the idle time.
 *  `{ open: true }` when no PIN is set (nothing to lock); `{ expires: null }`
 *  when the unlock has already lapsed. Never starts an unlock on its own. */
export async function touchAdminSession(): Promise<{ open: boolean; expires: number | null }> {
  if (!(await adminPinSet())) return { open: true, expires: null };
  if (!(await hasValidUnlockCookie())) return { open: false, expires: null };
  return { open: false, expires: await startAdminSession() };
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

async function hasValidUnlockCookie(): Promise<boolean> {
  const store = await cookies();
  return adminUnlockValid(store.get(COOKIE)?.value);
}

/** Admin: a signed-in parent (or first run, before anyone can sign in), plus a
 *  current unlock when a PIN is set. */
export async function isAdmin(): Promise<boolean> {
  if (!(await webBootstrapOpen())) {
    const store = await cookies();
    if (!(await webSessionUser(store.get(USER_COOKIE)?.value))) return false;
  }
  if (!(await adminPinSet())) return true;
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

/** Set (or change) the shared admin PIN. Every existing unlock stops verifying
 *  (the unlock is signed with the PIN hash); callers re-issue their own. */
export async function saveAdminPin(pin: string): Promise<void> {
  await setSetting(ADMIN_PIN_KEY, hashPin(pin));
}

/** Remove the shared admin PIN and end the current unlock. */
export async function clearAdminPin(): Promise<void> {
  await clearSetting(ADMIN_PIN_KEY);
  await endAdminSession();
}
