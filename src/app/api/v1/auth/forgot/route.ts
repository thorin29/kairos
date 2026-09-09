import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { requestPasswordReset } from "@/lib/accounts";
import { clientIp } from "@/lib/api/request";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-service password reset. Takes a name or email and, if it matches an
 * active account with an email on file, mails a one-time reset link there.
 * Public and rate-limited. Always answers the same ("ok") whether or not
 * anything was sent, so it can't be used to discover which accounts exist.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`forgot:${clientIp(req)}`, 5, 300_000);
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

  await requestPasswordReset(identifier);
  return apiOk({ ok: true });
}
