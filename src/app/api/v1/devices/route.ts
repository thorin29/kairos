import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice, listDevices } from "@/lib/api/device-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** This person's own enrolled devices — so anyone can see what's on their
 *  account and spot one they don't recognise, without needing the admin panel.
 *  `current` marks the calling device. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const now = Date.now();
  const devices = (await listDevices(authed.device.person.id)).map((d) => {
    const status = d.revokedAt
      ? "revoked"
      : d.expiresAt.getTime() < now
        ? "expired"
        : "active";
    return {
      id: d.id,
      name: d.name,
      enrolledAt: d.createdAt.toISOString(),
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      status,
      current: d.id === authed.device.deviceId,
    };
  });
  return apiOk({ devices });
}
