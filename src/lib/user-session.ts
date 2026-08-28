import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { appSecret } from "@/lib/secret";
import { cookieSecure } from "@/lib/cookie-flags";

/**
 * A personal sign-in, distinct from the shared admin unlock. The wall tablet
 * stays a no-login household screen; this is who is signed in on a personal
 * device (a phone), so views can be focused and actions attributed.
 *
 * The cookie is stateless — `userId.expiry.version`, HMAC-signed — matching the
 * admin session's "no session table" design. `version` is the person's
 * `credentialVersion`; if that is bumped (password reset, login disabled) the
 * cookie no longer matches and every prior session is void. Sessions are
 * long-lived by design, because a personal device should stay signed in.
 */
const COOKIE = "fd_user";
const SESSION_DAYS = 30;

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function startUserSession(
  userId: string,
  credentialVersion: number,
): Promise<void> {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${userId}.${expires}.${credentialVersion}`;
  const store = await cookies();
  store.set(COOKIE, `${payload}.${sign(payload, await appSecret())}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endUserSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export type CurrentUser = {
  id: string;
  name: string;
  displayName: string | null;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
  role: "ADMIN" | "MEMBER";
};

/** The signed-in person, or null. Verifies the signature, the expiry, that the
 *  person is still active, and that their credential version still matches. */
export async function currentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [userId, expires, version, signature] = parts;

  const payload = `${userId}.${expires}.${version}`;
  if (!safeEqual(signature, sign(payload, await appSecret()))) return null;
  if (Number(expires) < Date.now()) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      avatarPath: true, avatarPosition: true,
      role: true,
      isActive: true,
      passwordHash: true,
      credentialVersion: true,
    },
  });

  if (!user || !user.isActive || !user.passwordHash) return null;
  if (user.credentialVersion !== Number(version)) return null;

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

/** Guard for actions that require a signed-in person. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) throw new Error("Sign in to do that.");
  return user;
}
