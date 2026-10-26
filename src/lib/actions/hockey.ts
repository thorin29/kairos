"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { saveHockeyConfig, loadHockey, saveHockeyPrefs } from "@/lib/hockey";
import { currentUser } from "@/lib/user-session";

/** Save where Hockey's ice times come from. Admin only. */
export async function saveHockeyAction(input: {
  url: string;
  token: string;
  clearToken?: boolean;
}): Promise<{ error: string | null }> {
  await requireAdmin();
  const res = await saveHockeyConfig(input);
  if (!res.error) {
    revalidatePath("/admin/hockey");
    revalidatePath("/hockey");
    revalidatePath("/", "layout");
  }
  return res;
}

/** Ask ice-time for the week, with the saved settings. Admin only. */
export async function testHockeyAction(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const r = await loadHockey();
  if (r.state === "off") return { ok: false, message: "Save an address first." };
  if (r.state === "error") return { ok: false, message: r.error };
  const n = r.view.sections.reduce((sum, s) => sum + s.rows.length, 0);
  const parts = [
    `Connected. ${n} session${n === 1 ? "" : "s"} this week in ${r.view.sections.length} section${r.view.sections.length === 1 ? "" : "s"}.`,
    ...r.view.warnings,
  ];
  return { ok: true, message: parts.join(" ") };
}

/** Save the signed-in person's own Hockey layout. Anyone signed in; it only
 *  ever writes their own. */
export async function saveHockeyPrefsAction(prefs: { order: string[]; open: string[] }): Promise<void> {
  const me = await currentUser();
  if (!me) return;
  await saveHockeyPrefs(me.id, prefs);
}
