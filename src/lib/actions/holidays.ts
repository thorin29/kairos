"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { setEnabledHolidayKeys } from "@/lib/holidays";

/** Save the full set of enabled holidays (admin only). */
export async function saveHolidays(keys: string[]): Promise<void> {
  await requireAdmin();
  await setEnabledHolidayKeys(keys);
  revalidatePath("/", "layout");
}
