"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { setDeviceMode, type DeviceMode } from "@/lib/device";

/** Set this device to shared (wall tablet) or personal (a phone). Admin only,
 *  and since the admin area is PIN-gated, so is this. */
export async function setDeviceModeAction(
  mode: DeviceMode,
): Promise<{ error: string | null }> {
  await requireAdmin();
  await setDeviceMode(mode);
  revalidatePath("/", "layout");
  return { error: null };
}
