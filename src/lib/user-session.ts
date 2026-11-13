import "server-only";
import { cookies } from "next/headers";
import { cookieSecure } from "@/lib/cookie-flags";
import { signUserSession, USER_COOKIE, webSessionUser, type WebUser } from "@/lib/web-gate";

/**
 * The web sign-in (required everywhere since v0.699, parents only; checks in
 * web-gate.ts). On the shared screen it acts for the household; on a browser
 * set to Personal mode it focuses on the signed-in parent.
 *
 * The cookie is stateless — `userId.expiry.version`, HMAC-signed — matching the
 * admin session's "no session table" design. `version` is the person's
 * `credentialVersion`; if that is bumped (password reset, login disabled) the
 * cookie no longer matches and every prior session is void. Sessions are
 * long-lived by design, because a personal device should stay signed in.
 */
const COOKIE = USER_COOKIE;
const SESSION_DAYS = 30;

export async function startUserSession(
  userId: string,
  credentialVersion: number,
): Promise<void> {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${userId}.${expires}.${credentialVersion}`;
  const store = await cookies();
  store.set(COOKIE, await signUserSession(payload), {
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

export type CurrentUser = WebUser;

/** The signed-in parent, or null (web-gate.ts: signature, expiry, active,
 *  password, credential version, and an admin account — web sign-in is for
 *  parents since v0.699; children use the phone app). */
export async function currentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  return webSessionUser(store.get(COOKIE)?.value);
}

/** Guard for actions that require a signed-in person. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) throw new Error("Sign in to do that.");
  return user;
}
