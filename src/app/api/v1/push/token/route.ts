import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The app registers (or clears, with null) this device's Firebase token. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: { token?: unknown };
  try {
    body = (await req.json()) as { token?: unknown };
  } catch {
    return apiError("validation", "Invalid JSON.");
  }
  const token = typeof body.token === "string" ? body.token.trim() : null;
  if (token != null && (token.length < 20 || token.length > 4096)) {
    return apiError("validation", "That doesn't look like a push token.");
  }
  await prisma.device.update({
    where: { id: authed.device.deviceId },
    data: { pushToken: token || null, pushTokenAt: token ? new Date() : null },
  });
  return apiOk({ ok: true });
}
