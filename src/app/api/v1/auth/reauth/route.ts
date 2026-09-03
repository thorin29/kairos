import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import {
  requireDeviceForReauth,
  setDeviceReauthed,
  personPayload,
} from "@/lib/api/device-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/api/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-authenticate an already-enrolled device after its account's password
 * changed. Bearer required (the still-valid device token, even though its
 * credential version is stale). On the right password, the device's credential
 * version is brought current and it keeps working — no re-enrollment.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`reauth:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return apiError("rate_limited", "Too many attempts. Try again shortly.", {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  const authed = await requireDeviceForReauth(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const password =
    typeof (body as Record<string, unknown>)?.password === "string"
      ? ((body as Record<string, unknown>).password as string)
      : "";
  if (!password) {
    return apiError("validation", "Password is required.", {
      fields: { password: "required" },
    });
  }

  const ok = await setDeviceReauthed(
    authed.device.deviceId,
    authed.device.person.id,
    password,
  );
  if (!ok) return apiError("unauthenticated", "Wrong password.");

  return apiOk({ person: personPayload(authed.device.person) });
}
