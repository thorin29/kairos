import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice, refreshDevice } from "@/lib/api/device-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rotate this device's token. Requires a currently-valid token; the returned
 *  token replaces it, and the old one stops working immediately. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const rotated = await refreshDevice(authed.device.deviceId);
  return apiOk({
    token: rotated.token,
    expiresAt: rotated.expiresAt.toISOString(),
  });
}
