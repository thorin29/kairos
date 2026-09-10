import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { authenticate } from "@/lib/accounts";
import { signLoginProof } from "@/lib/api/login-proof";
import { personPayloadById } from "@/lib/api/device-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/api/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify a username/email + password and return the matching person. This backs
 * the app's UNLOCK flow: a locked phone re-confirms its enrolled person's
 * password before unlocking (the device token is kept across a lock), so this is
 * a password check, not an enrollment step. Like the web login, it never says
 * which of identifier/password was wrong. The returned `loginToken` is a legacy
 * proof retained only because the client's LoginResponse DTO still requires the
 * field; no current client reads its value. Rate-limited per source and per
 * identifier.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`login:${clientIp(req)}`, 10, 60_000);
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
  const identifier = typeof raw?.identifier === "string" ? raw.identifier : "";
  const password = typeof raw?.password === "string" ? raw.password : "";

  if (!identifier.trim() || !password) {
    return apiError("validation", "Username and password are required.", {
      fields: {
        identifier: identifier.trim() ? "" : "required",
        password: password ? "" : "required",
      },
    });
  }

  // Secondary limit keyed by the account itself, so rotating source IPs can't
  // brute-force one identifier past the per-IP ceiling above.
  const rlId = rateLimit(
    `login-id:${identifier.trim().toLowerCase()}`,
    10,
    60_000,
  );
  if (!rlId.ok) {
    return apiError("rate_limited", "Too many attempts. Try again shortly.", {
      retryAfterSec: rlId.retryAfterSec,
    });
  }

  const auth = await authenticate(identifier, password);
  if (!auth) {
    return apiError("unauthenticated", "Wrong username or password.");
  }

  const loginToken = await signLoginProof(auth.id, auth.credentialVersion);
  const person = await personPayloadById(auth.id);
  return apiOk({ loginToken, person });
}
