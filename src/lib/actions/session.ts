"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { rateLimit, rateLimitReset } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/api/request";
import {
  adminPinSet,
  clearAdminPin,
  endAdminSession,
  isAdmin,
  requireAdmin,
  saveAdminPin,
  startAdminSession,
  verifyAdminPin,
} from "@/lib/session";

export type UnlockState = { error: string | null; ok: boolean };

/** Unlocks administration with the shared PIN (or straight away if none set). */
export async function unlockAdmin(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const pin = String(formData.get("pin") ?? "").trim();

  // No PIN set means admin is open — unlock without asking.
  if (!(await adminPinSet())) {
    await startAdminSession();
    revalidatePath("/", "layout");
    return { error: null, ok: true };
  }

  if (!/^\d{4,8}$/.test(pin)) {
    return { error: "Enter your 4 to 8 digit PIN.", ok: false };
  }

  // 3 tries per 15 minutes, per device (v0.699). The PIN keeps others out of
  // settings; it isn't a security boundary (sign-in is). Counting per device
  // means one person burning tries can't lock a parent out on another screen.
  const pinKey = `admin-pin:${clientIpFromHeaders(await headers())}`;
  const limit = rateLimit(pinKey, 3, 15 * 60_000);
  if (!limit.ok) {
    return {
      error: `Too many tries. Try again in ${Math.max(1, Math.ceil(limit.retryAfterSec / 60))} min.`,
      ok: false,
    };
  }

  if (!(await verifyAdminPin(pin))) {
    return { error: "That PIN doesn't match.", ok: false };
  }

  rateLimitReset(pinKey);
  await startAdminSession();
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}

export async function lockAdmin(): Promise<void> {
  await endAdminSession();
  revalidatePath("/", "layout");
}

/**
 * Set or change the shared admin PIN. Changing an existing PIN requires the
 * current one. Only an unlocked admin can do this.
 */
export async function saveAdminPinAction(input: {
  currentPin?: string;
  newPin: string;
}): Promise<{ error: string | null }> {
  await requireAdmin();

  const newPin = (input.newPin ?? "").trim();
  if (!/^\d{4,8}$/.test(newPin)) {
    return { error: "Choose a 4 to 8 digit PIN." };
  }

  // If a PIN already exists, the current one is required to change it.
  if (await adminPinSet()) {
    const current = (input.currentPin ?? "").trim();
    if (!(await verifyAdminPin(current))) {
      return { error: "The current PIN doesn't match." };
    }
  }

  await saveAdminPin(newPin);
  // The unlock is signed with the PIN hash, so this ends every other device's
  // unlock; re-issue it here to keep whoever set it unlocked.
  await startAdminSession();
  revalidatePath("/", "layout");
  revalidatePath("/setup");
  return { error: null };
}

/** Turn the shared PIN off. Requires entering it, even when already unlocked. */
export async function disableAdminPinAction(input: {
  pin: string;
}): Promise<{ error: string | null }> {
  if (!(await isAdmin())) {
    return { error: "Unlock admin first." };
  }
  if (!(await adminPinSet())) return { error: null }; // already off

  const pin = (input.pin ?? "").trim();
  if (!(await verifyAdminPin(pin))) {
    return { error: "That PIN doesn't match." };
  }

  await clearAdminPin();
  revalidatePath("/", "layout");
  revalidatePath("/setup");
  return { error: null };
}
