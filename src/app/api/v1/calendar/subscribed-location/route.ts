import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setSubscribedLocationCore } from "@/lib/actions/calendars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set a subscribed (feed) event's location override from a phone.
 *  Body: { eventId: string, location: string } — "" clears it. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }

  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!eventId) return apiError("validation", "Missing eventId.");
  const location = typeof body.location === "string" ? body.location : "";

  await setSubscribedLocationCore(eventId, location);
  return apiOk({ status: "ok" });
}
