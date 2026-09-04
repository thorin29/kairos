import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { deleteEventCore, type DeleteScope } from "@/lib/calendar/delete-event-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isScope = (s: unknown): s is DeleteScope =>
  s === "all" || s === "future" || s === "one";

/** Delete an event for the enrolled person. Non-admins can only remove their own
 *  or family events; recurring/birthday events stay admin-only; feed events can't
 *  be deleted here. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const eventId = typeof raw.eventId === "string" ? raw.eventId : "";
  if (!eventId) return apiError("validation", "eventId is required.");
  const scope: DeleteScope = isScope(raw.scope) ? raw.scope : "all";
  const occurrenceISO = typeof raw.occurrenceISO === "string" ? raw.occurrenceISO : undefined;

  const res = await deleteEventCore(eventId, scope, occurrenceISO, {
    isAdmin: authed.device.person.role === "ADMIN",
    callerUserId: authed.device.person.id,
  });
  if (res.error) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
