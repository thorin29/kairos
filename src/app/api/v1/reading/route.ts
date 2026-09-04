import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadReadingPagePayload } from "@/lib/queries/reading-page";
import { generateReadingTasks } from "@/lib/bible/generate";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The whole Bible screen in one read: the family reading deck + coverage, and
 *  this person's own coverage, plan, and hand-marked chapters. Runs the same
 *  reading-task reconcile the web page does on load. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const today = todayISO();
  await generateReadingTasks(today);

  const payload = await loadReadingPagePayload(authed.device.person.id, today);
  return apiOk(payload);
}
