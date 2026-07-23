"use server";

import { revalidatePath } from "next/cache";
import { clearSetting, SCORING_START, setSetting } from "@/lib/settings";

export type SettingsState = { error: string | null; saved: boolean };

export async function saveScoringStart(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const value = String(formData.get("scoringStart") ?? "").trim();

  if (!value) {
    await clearSetting(SCORING_START);
    revalidatePath("/");
    revalidatePath("/setup");
    return { error: null, saved: true };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: "That date isn't valid.", saved: false };
  }

  await setSetting(SCORING_START, value);
  revalidatePath("/");
  revalidatePath("/setup");
  return { error: null, saved: true };
}
