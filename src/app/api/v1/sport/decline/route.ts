import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { declineSportCore } from "@/lib/sport/core";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "No" for a finished sport event on the home dashboard. */
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
  const dateISO = typeof raw.dateISO === "string" ? raw.dateISO : todayISO();

  await declineSportCore(eventId, authed.device.person.id, dateISO);
  return apiOk({ status: "ok" });
}
