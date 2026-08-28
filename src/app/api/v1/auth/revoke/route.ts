import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice, revokeDevice } from "@/lib/api/device-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revoke (sign out) this device. After this the presented token no longer
 *  verifies; re-enrolling needs a new code from a parent. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  await revokeDevice(authed.device.deviceId);
  return apiOk({ revoked: true });
}
