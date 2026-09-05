import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { createPersonalEvent } from "@/lib/calendar/create-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create a basic personal event for the enrolled person (Phase 3a). */
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

  const p = authed.device.person;
  const res = await createPersonalEvent(
    p.id,
    {
      title: str("title") ?? "",
      allDay: raw.allDay === true,
      date: str("date") ?? "",
      start: str("start"),
      end: str("end"),
      endDate: str("endDate"),
      location: str("location"),
      timezone: str("timezone"),
      repeat: str("repeat"),
      isFamily: raw.isFamily === true,
      kind: str("kind"),
      eventTypeId: str("eventTypeId"),
      participants: Array.isArray(raw.participants)
        ? raw.participants.filter((x): x is string => typeof x === "string")
        : undefined,
    },
    p.role === "ADMIN" || p.kind === "PARENT",
  );
  if (res.error) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
