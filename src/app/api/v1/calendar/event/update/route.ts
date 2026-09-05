import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { updatePersonalEvent } from "@/lib/calendar/create-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Edit a non-recurring personal event for the enrolled person. */
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
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const eventId = str("eventId") ?? "";
  if (!eventId) return apiError("validation", "eventId is required.");

  const res = await updatePersonalEvent(
    authed.device.person.id,
    eventId,
    {
      title: str("title") ?? "",
      allDay: raw.allDay === true,
      date: str("date") ?? "",
      start: str("start"),
      end: str("end"),
      endDate: str("endDate"),
      location: str("location"),
      timezone: str("timezone"),
    },
    authed.device.person.role === "ADMIN",
  );
  if (res.error) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
