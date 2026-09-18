import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadEventNamePicker } from "@/lib/queries/event-names";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The remembered event names, alphabetical, for the app's new-event name
 *  picker. Shared family data — any enrolled device may read it. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const data = await loadEventNamePicker();
  return apiOk(data);
}
