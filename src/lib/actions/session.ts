"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyPin } from "@/lib/auth";
import { endSession, startSession } from "@/lib/session";

export type SignInState = { error: string | null };

/**
 * Picking a profile is how you sign in. Accounts with a PIN must enter it;
 * accounts without one are a single tap, which is the point for children on
 * a shared tablet.
 */
export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const userId = String(formData.get("userId") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return { error: "That profile is gone." };

  if (user.pinHash) {
    if (!pin) return { error: "Enter the PIN." };
    if (!verifyPin(pin, user.pinHash)) return { error: "That PIN is wrong." };
  }

  await startSession(user.id);

  revalidatePath("/", "layout");
  return { error: null };
}

export async function signOut(): Promise<void> {
  await endSession();
  revalidatePath("/", "layout");
}
