import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice, personPayload } from "@/lib/api/device-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The person this device is enrolled to: id, name, avatar, role, kind. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  return apiOk(personPayload(authed.device.person));
}
