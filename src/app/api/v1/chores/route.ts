import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadChoresPagePayload } from "@/lib/queries/chores-page";
import { generateChores } from "@/lib/chores/generate";
import { generatePoolChores } from "@/lib/chores/pool";
import { generateAnytimeChores } from "@/lib/chores/anytime";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The read-only chore overview (mirrors the web /chores page): the pause banner,
 * this week's per-person numbers, the weekly rotation, always-open counts, and
 * shared (pool) status — scoped to who the device's person may see. Runs the
 * same chore reconcile the dashboard does, so the week is accurate even if Home
 * wasn't opened first. Completion is on the dashboard, not here.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const today = todayISO();
  await generateChores(today);
  await generatePoolChores(today);
  await generateAnytimeChores(today);

  const payload = await loadChoresPagePayload(authed.device.person.id, today);
  return apiOk(payload);
}
