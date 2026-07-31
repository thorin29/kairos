"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import {
  authenticate,
  disableLogin,
  issueInvite,
  redeemInvite,
  revokeInvites,
  setUserEmail,
  userEmail,
  MIN_PASSWORD,
} from "@/lib/accounts";
import { startUserSession, endUserSession } from "@/lib/user-session";
import { rateLimit, rateLimitReset } from "@/lib/rate-limit";
import { baseUrl, inviteLink } from "@/lib/url";
import { sendInviteEmail, sendTestEmail } from "@/lib/mail/send";
import { saveSmtp, type SmtpInput } from "@/lib/mail/config";

export type LoginState = { error: string | null; ok: boolean };

/** Sign in with a name or email, plus password. Rate-limited to blunt guessing. */
export async function loginUser(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { error: "Enter your name or email and your password.", ok: false };
  }

  const key = `login:${identifier.toLowerCase()}`;
  const limit = rateLimit(key, 10, 10 * 60_000);
  if (!limit.ok) {
    return {
      error: `Too many attempts. Try again in ${limit.retryAfterSec}s.`,
      ok: false,
    };
  }

  const user = await authenticate(identifier, password);
  if (!user) {
    // One message for both cases, so a wrong identifier can't be told from a
    // wrong password.
    return { error: "That login and password don't match.", ok: false };
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
 *  reset. Returns the one-time link to hand over, and — if the person has an
 *  email and SMTP is set up — emails it too. Admin only. */
export async function createInviteAction(userId: string): Promise<{
  error: string | null;
  token?: string;
  expiresAt?: string;
  emailedTo?: string;
  emailError?: string;
}> {
  await requireAdmin();
  const { token, expiresAt } = await issueInvite(userId);

  let emailedTo: string | undefined;
  let emailError: string | undefined;
  const to = await userEmail(userId);
  if (to) {
    const link = inviteLink(await baseUrl(), token);
    const res = await sendInviteEmail(to, to, link);
    if (res.sent) emailedTo = to;
    else if (res.error) emailError = res.error;
  }

  revalidatePath("/setup");
  return {
    error: null,
    token,
    expiresAt: expiresAt.toISOString(),
    emailedTo,
    emailError,
  };
}

/** Set or clear a person's email address. Admin only. */
export async function setUserEmailAction(
  userId: string,
  email: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  const value = email.trim();
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { error: "That doesn't look like an email address." };
  }
  const res = await setUserEmail(userId, value);
  revalidatePath("/setup");
  return res;
}

/** Save the SMTP settings from the admin Email page. Admin only. */
export async function saveSmtpAction(
  input: SmtpInput,
): Promise<{ error: string | null }> {
  await requireAdmin();
  await saveSmtp(input);
  revalidatePath("/admin/email");
  return { error: null };
}

/** Send a test email to the given address, reporting the raw SMTP error on
 *  failure. Admin only. */
export async function sendTestEmailAction(
  to: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
    return { ok: false, error: "Enter a valid email address to test." };
  }
  return sendTestEmail(to.trim());
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
