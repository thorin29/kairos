"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { hatchEggCore } from "@/lib/companions-hatch";

/** Web action: hatch a ready egg for a person (interactive web session). */
export async function hatchEgg(
  userId: string,
  mode: "new" | "deepen",
): Promise<{ error: string | null; hatched?: string }> {
  await requireInteractive();
  await requireCanActFor(userId);
  const res = await hatchEggCore(userId, mode);
  revalidatePath(`/person/${userId}`);
  revalidatePath("/summary");
  return res;
}
