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
 * Verify a username/email + password and return a short-lived login proof. This
 * is the first of two factors for a password account: the app then hands the
 * proof back to /auth/enroll with a device code to complete enrollment. Like the
 * web login, it never says which of identifier/password was wrong.
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

  const auth = await authenticate(identifier, password);
  if (!auth) {
    return apiError("unauthenticated", "Wrong username or password.");
  }

  const loginToken = await signLoginProof(auth.id, auth.credentialVersion);
  const person = await personPayloadById(auth.id);
  return apiOk({ loginToken, person });
}
