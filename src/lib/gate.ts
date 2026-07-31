import "server-only";
import { getSetting } from "@/lib/settings";
import { isAdmin } from "@/lib/session";
import { currentUser } from "@/lib/user-session";

/**
 * Login-gating is a single switch, off by default so existing installs and a
 * fresh first run are unchanged. Turned on (for a public domain), every page
 * requires a session and the conditional guards below start enforcing.
 *
 * The design point: in the shared model most actions are intentionally open
 * (anyone at the tablet checks off a chore). These guards therefore do nothing
 * in open mode and only bite once login is required — at which point the shared
 * tablet is itself signed in as an admin, so it still passes.
 */
export const REQUIRE_LOGIN = "requireLogin";

export async function loginRequired(): Promise<boolean> {
  return (await getSetting(REQUIRE_LOGIN)) === "true";
}

/** Paths reachable without a session even when gating is on. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/join")
  );
}

/** Open mode: allow (shared screen). Gated mode: require a signed-in person.
 *  On the shared tablet that person is the admin, so it still passes. */
export async function requireInteractive(): Promise<void> {
  if (!(await loginRequired())) return;
  if (!(await currentUser())) throw new Error("Sign in to do that.");
}

/** Open mode: allow. Gated mode: the actor must be an admin (unlock or admin
 *  account) or the subject themselves. */
export async function requireAdminOrSelf(subjectUserId: string): Promise<void> {
  if (!(await loginRequired())) return;
  if (await isAdmin()) return;
  const me = await currentUser();
  if (me && (me.role === "ADMIN" || me.id === subjectUserId)) return;
  throw new Error("You can only edit your own profile.");
}
