import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice, revokeOwnDevice } from "@/lib/api/device-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revoke one of the caller's own devices. Revoking the current device signs it
 *  out on its next request. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const { id } = await params;
  const r = await revokeOwnDevice(id, authed.device.person.id);
  if (r === "not_found") return apiError("not_found", "No such device.");
  if (r === "forbidden") return apiError("forbidden", "Not your device.");
  return apiOk({ id, revoked: true });
}
