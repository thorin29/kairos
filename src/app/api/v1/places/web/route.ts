import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { placesEnabled } from "@/lib/places/live";
import { createTicket, isEmbedPath } from "@/lib/places/embed-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A one-time ticket for the app's Places WebView (v0.762). The app opens
 * `path` on this server; the ticket works once, within a minute, and becomes
 * a 12-hour cookie for the Places pages only. `to` picks the page:
 * `/places/embed` (everyone) or `/places/embed/<personId>` (a person's day).
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  if (!(await placesEnabled())) return apiOk({ state: "off" });
  let to = "/places/embed";
  try {
    const body = (await req.json()) as { to?: unknown };
    if (typeof body.to === "string" && body.to) to = body.to;
  } catch {
    // No body: everyone.
  }
  if (!isEmbedPath(to) || to === "/places/embed/start") return apiError("validation", "Unknown Places page.");
  const t = createTicket(authed.device.person.id, authed.device.deviceId);
  return apiOk({ state: "ok", path: `/places/embed/start?t=${encodeURIComponent(t)}&to=${encodeURIComponent(to)}` });
}
