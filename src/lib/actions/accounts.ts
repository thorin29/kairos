"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import {
  authenticate,
  disableLogin,
  issueInvite,
  redeemInvite,
  revokeInvites,
  MIN_PASSWORD,
} from "@/lib/accounts";
import { startUserSession, endUserSession } from "@/lib/user-session";
import { rateLimit, rateLimitReset } from "@/lib/rate-limit";

export type LoginState = { error: string | null; ok: boolean };

/** Sign in with a name and password. Rate-limited per name to blunt guessing. */
export async function loginUser(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !password) {
    return { error: "Enter your name and password.", ok: false };
  }

  const key = `login:${name.toLowerCase()}`;
  const limit = rateLimit(key, 10, 10 * 60_000);
  if (!limit.ok) {
    return {
      error: `Too many attempts. Try again in ${limit.retryAfterSec}s.`,
      ok: false,
    };
  }

  const user = await authenticate(name, password);
  if (!user) {
    // One message for both cases, so a wrong name can't be told from a wrong
    // password.
    return { error: "That name and password don't match.", ok: false };
  }

  rateLimitReset(key);
  await startUserSession(user.id, user.credentialVersion);
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}

export async function logoutUser(): Promise<void> {
  await endUserSession();
  revalidatePath("/", "layout");
}

/** Issue (or re-issue) an invite for a person. Re-issuing is how a password is
 *  reset. Returns the one-time link to hand over. Admin only. */
export async function createInviteAction(
  userId: string,
): Promise<{ error: string | null; token?: string; expiresAt?: string }> {
  await requireAdmin();
  const { token, expiresAt } = await issueInvite(userId);
  revalidatePath("/setup");
  return { error: null, token, expiresAt: expiresAt.toISOString() };
}

export async function revokeInviteAction(
  userId: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  await revokeInvites(userId);
  revalidatePath("/setup");
  return { error: null };
}

export async function disableLoginAction(
  userId: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  await disableLogin(userId);
  revalidatePath("/setup");
  return { error: null };
}

export type RedeemState = { error: string | null; ok: boolean };

/** Redeem an invite by setting a password. On success the person is signed in. */
export async function redeemInviteAction(
  _prev: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD) {
    return {
      error: `Use at least ${MIN_PASSWORD} characters.`,
      ok: false,
    };
  }
  if (password !== confirm) {
    return { error: "The two passwords don't match.", ok: false };
  }

  const limit = rateLimit(`redeem:${token.slice(0, 12)}`, 10, 10 * 60_000);
  if (!limit.ok) {
    return {
      error: `Too many attempts. Try again in ${limit.retryAfterSec}s.`,
      ok: false,
    };
  }

  const user = await redeemInvite(token, password);
  if (!user) {
    return {
      error: "This invite link is invalid or has expired. Ask for a new one.",
      ok: false,
    };
  }

  await startUserSession(user.id, user.credentialVersion);
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}
