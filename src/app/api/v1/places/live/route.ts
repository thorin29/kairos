import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadLive, placesEnabled } from "@/lib/places/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everyone's current position for the phone (the same `loadLive` as the web
 * Places page): newest point, moving or since-when, battery, and the spot's
 * name. `state` is "off" until Places is set up (map key, Map ID and at least
 * one tracked person). Everyone sees everyone.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  if (!(await placesEnabled())) return apiOk({ state: "off" });
  return apiOk({ state: "ok", ...(await loadLive()) });
}
