import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadEventTypes } from "@/lib/queries/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The building blocks the app needs to configure calendar notifications: the
 * household's event types. Birthdays are handled as their own toggle in the app,
 * so they aren't listed here.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const types = await loadEventTypes();
  return apiOk({
    eventTypes: types.map((t) => ({ id: t.id, name: t.name, color: t.color })),
  });
}
