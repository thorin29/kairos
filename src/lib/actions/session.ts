"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyPin } from "@/lib/auth";
import { endAdminSession, startAdminSession } from "@/lib/session";

export type UnlockState = { error: string | null; ok: boolean };

/**
 * Unlocks administration. Any parent's PIN works; which parent it was is
 * recorded on the session but nothing branches on it.
 */
export async function unlockAdmin(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const pin = String(formData.get("pin") ?? "").trim();

  if (!/^\d{4,8}$/.test(pin)) {
    return { error: "Enter your 4 to 8 digit PIN.", ok: false };
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true, pinHash: { not: null } },
  });

  if (admins.length === 0) {
    return {
      error: "No parent account has a PIN set yet.",
      ok: false,
    };
  }

  const match = admins.find((a) => verifyPin(pin, a.pinHash!));
  if (!match) return { error: "That PIN doesn't match.", ok: false };

  await startAdminSession(match.id);
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}

export async function lockAdmin(): Promise<void> {
  await endAdminSession();
  revalidatePath("/", "layout");
}
