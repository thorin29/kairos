import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadWidgetPayload } from "@/lib/queries/widget";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Android home-screen widget's feed: the next 7 days of events (colored as
 * the person's Calendar colors them) and their own open tasks, plus a count of
 * overdue tasks. `?scope=mine` limits events to their own; anything else is
 * the whole family.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const scope = req.nextUrl.searchParams.get("scope") === "mine" ? "mine" : "family";
  return apiOk(await loadWidgetPayload(authed.device.person.id, todayISO(), scope));
}
