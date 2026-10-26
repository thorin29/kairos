import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadHockey, hockeyEventTypeId, getHockeyPrefs } from "@/lib/hockey";
import { arrangeSections } from "@/lib/hockey-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The week of ice times for the phone's Hockey screen, shaped by the same
 * `buildHockeyView` as the web page — names, buttons and saved locations
 * included — so the app only draws it. Asked of ice-time on every call;
 * nothing is stored. `state` is "off" when Hockey isn't set up and "error"
 * when ice-time can't be reached (with a message to show). Sections come in
 * this person's own order, each with `open` (everything starts collapsed).
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const load = await loadHockey();
  if (load.state === "off") return apiOk({ state: "off" });
  if (load.state === "error") return apiOk({ state: "error", error: load.error });
  const [typeId, prefs] = await Promise.all([
    hockeyEventTypeId(),
    getHockeyPrefs(authed.device.person.id),
  ]);
  return apiOk({
    state: "ok",
    eventTypeId: typeId,
    ...load.view,
    sections: arrangeSections(load.view.sections, prefs),
  });
}
