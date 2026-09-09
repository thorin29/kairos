import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import {
  redeemJoin,
  personPayload,
  notifyNewDeviceEnrolled,
} from "@/lib/api/device-auth";
import { clientIp } from "@/lib/api/request";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Redeem an invite from the app: set the password (new account) or confirm it
 * (existing account), then enroll this phone. Unauthenticated by design — like
 * /auth/enroll, it must be reachable from a new phone with no session — and
 * guarded by the invite's short life, single use, and rate limiting.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`join:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return apiError("rate_limited", "Too many attempts. Try again shortly.", {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }

  const raw = body as Record<string, unknown> | null;
  const token = typeof raw?.token === "string" ? raw.token : "";
  const password = typeof raw?.password === "string" ? raw.password : "";
  const deviceName =
    typeof raw?.deviceName === "string" ? raw.deviceName : null;

  if (!token.trim()) {
    return apiError("validation", "An invite is required.", {
      fields: { token: "required" },
    });
  }
  if (!password) {
    return apiError("validation", "A password is required.", {
      fields: { password: "required" },
    });
  }

  // Secondary limit keyed by the invite, so rotating IPs can't brute-force a
  // password on one existing-account invite past the per-IP ceiling.
  const rlTok = rateLimit(`join-token:${token.trim()}`, 10, 300_000);
  if (!rlTok.ok) {
    return apiError("rate_limited", "Too many attempts. Try again shortly.", {
      retryAfterSec: rlTok.retryAfterSec,
    });
  }

  const result = await redeemJoin(token, password, deviceName);
  if (!result.ok) {
    if (result.reason === "wrong_password") {
      return apiError("unauthenticated", "That password doesn't match. Try again.");
    }
    if (result.reason === "weak") {
      return apiError("validation", "Choose a password of at least 6 characters.", {
        fields: { password: "weak" },
      });
    }
    return apiError("forbidden", "That invite is invalid or has expired.");
  }

  await notifyNewDeviceEnrolled(result.person.id, deviceName);
  return apiOk({
    token: result.token,
    expiresAt: result.expiresAt.toISOString(),
    person: personPayload(result.person),
  });
}
