import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import {
  redeemEnrollmentCode,
  personPayload,
  notifyNewDeviceEnrolled,
} from "@/lib/api/device-auth";
import { clientIp } from "@/lib/api/request";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Redeem a one-time enrollment code for a device token. The only unauthenticated
 * endpoint — it is designed to be reachable from the internet (a phone anywhere)
 * and is protected by the code's short life, single use, and per-source rate
 * limiting rather than by a session.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`enroll:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return apiError("rate_limited", "Too many attempts. Try again shortly.", {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.", {
      fields: { code: "required" },
    });
  }

  const raw = body as Record<string, unknown> | null;
  const code = typeof raw?.code === "string" ? raw.code : "";
  const deviceName =
    typeof raw?.deviceName === "string" ? raw.deviceName : null;
  const loginToken =
    typeof raw?.loginToken === "string" ? raw.loginToken : null;

  if (!code.trim()) {
    return apiError("validation", "An enrollment code is required.", {
      fields: { code: "required" },
    });
  }

  const result = await redeemEnrollmentCode(code, deviceName, loginToken);
  if (!result.ok) {
    if (result.reason === "login_required") {
      return apiError(
        "unauthenticated",
        "Sign in with your password first, then enter your code.",
      );
    }
    if (result.reason === "reauth") {
      return apiError(
        "unauthenticated",
        "Your sign-in expired — sign in again, then enter your code.",
      );
    }
    return apiError(
      "forbidden",
      "That enrollment code is invalid or has expired.",
    );
  }

  // Tripwire: let the person know a device was just added to their account.
  await notifyNewDeviceEnrolled(result.person.id, deviceName);

  return apiOk({
    token: result.token,
    expiresAt: result.expiresAt.toISOString(),
    person: personPayload(result.person),
  });
}
