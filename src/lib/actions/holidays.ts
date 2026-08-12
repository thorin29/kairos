"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { setEnabledHolidayKeys, setHolidayColorValue } from "@/lib/holidays";

/** Save the full set of enabled holidays (admin only). */
export async function saveHolidays(keys: string[]): Promise<void> {
  await requireAdmin();
  await setEnabledHolidayKeys(keys);
  revalidatePath("/", "layout");
}

/** Change the shared holiday colour (admin only). */
export async function setHolidayColor(color: string): Promise<void> {
  await requireAdmin();
  await setHolidayColorValue(color);
  revalidatePath("/", "layout");
}
