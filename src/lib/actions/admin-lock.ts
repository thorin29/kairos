"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, setAdminIdleMinutes, touchAdminSession } from "@/lib/session";

/** Admin activity from AdminIdleLock: push the unlock's expiry back. Returns
 *  when it now lapses, or that it already has (the client then shows the PIN
 *  screen). Never unlocks anything by itself. */
export async function touchAdminAction(): Promise<{ open: boolean; expires: number | null }> {
  return touchAdminSession();
}

/** Admin → Settings → Device: minutes with no admin activity before it locks. */
export async function setAdminIdleAction(minutes: number): Promise<{ error: string | null }> {
  await requireAdmin();
  try {
    await setAdminIdleMinutes(minutes);
  } catch {
    return { error: "Pick one of the listed times." };
  }
  // Apply the new length to this unlock straight away.
  await touchAdminSession();
  revalidatePath("/admin/device");
  return { error: null };
}
