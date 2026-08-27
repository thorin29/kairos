"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, adminPinSet } from "@/lib/session";
import { setDeviceMode, type DeviceMode } from "@/lib/device";
import { REQUIRE_LOGIN } from "@/lib/gate";
import { setSetting } from "@/lib/settings";
import { loginableCount } from "@/lib/accounts";

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

/** Turn required sign-in on or off. It can't be turned on until at least one
 *  person has a password, otherwise the install would lock everyone out. */
export async function setRequireLoginAction(
  on: boolean,
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (on && (await loginableCount()) === 0) {
    return {
      error:
        "Set up at least one login first (invite someone in Accounts), or you'll lock everyone out.",
    };
  }

  if (on && !(await adminPinSet())) {
    return {
      error:
        "Set an admin PIN first (Admin \u2192 Lock). Without one, the admin area would be open to everyone once sign-in is required.",
    };
  }

  await setSetting(REQUIRE_LOGIN, on ? "true" : "false");
  revalidatePath("/", "layout");
  return { error: null };
}
