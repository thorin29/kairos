"use server";

import { revalidatePath } from "next/cache";
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
  if (!(await verifyAdminPin(pin))) {
    return { error: "That PIN doesn't match.", ok: false };
  }

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
  await startAdminSession(); // keep whoever set it unlocked
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
