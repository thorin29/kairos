import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setSubscribedRemindersCore } from "@/lib/actions/calendars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set the signed-in phone's reminders on a subscribed (feed) event.
 *  Body: { eventId: string, reminders: number[] } — minutes before, [] to clear. */
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
  const reminders = Array.isArray(body.reminders)
    ? body.reminders
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n >= 0)
    : [];

  await setSubscribedRemindersCore(authed.device.person.id, eventId, reminders);
  return apiOk({ status: "ok" });
}
