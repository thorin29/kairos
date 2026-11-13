import "server-only";
import { webBootstrapOpen } from "@/lib/web-gate";
import { isAdmin } from "@/lib/session";
import { currentUser } from "@/lib/user-session";

/**
 * Sign-in is required everywhere on the web (v0.699; middleware.ts enforces it
 * on every request, web-gate.ts holds the rules). Only a parent's account can
 * sign in, and the shared screen then acts for the household, so the guards
 * below pass for it exactly as the old open mode did. The one exception is
 * first run, before any admin has a password, when there's no one to sign in.
 */
export async function loginRequired(): Promise<boolean> {
  return !(await webBootstrapOpen());
}

/** Paths reachable without a session even when gating is on. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login")
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

/**
 * Ownership guard for per-person actions (log my money, my workout, my school
 * work…). Open mode is unchanged — the shared wall tablet acts for the whole
 * household, and an admin (or the tablet's admin unlock) always may. Once
 * login-gating is on, a signed-in non-admin can only act for themselves, so a
 * child on their own phone can't mutate a parent's or sibling's data by passing
 * another id. Shared resources (the grocery list, the chore pool, the calendar)
 * deliberately don't use this — anyone may act on those.
 */
export async function requireCanActFor(subjectUserId: string): Promise<void> {
  if (!(await loginRequired())) return;
  if (await isAdmin()) return;
  const me = await currentUser();
  if (me && (me.role === "ADMIN" || me.id === subjectUserId)) return;
  throw new Error("You can only do that for yourself.");
}
