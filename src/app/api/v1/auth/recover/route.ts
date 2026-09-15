import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { startDeviceRecovery } from "@/lib/accounts";
import { clientIp } from "@/lib/api/request";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-service phone recovery. Username/email + the account's own password; if
 * they're valid and the account has an email, a single-use join code is mailed
 * there. The phone is then enrolled via the normal /auth/join step using that
 * code + the password — so recovery needs both something you know (the password)
 * and something you have (access to the account's email), with no admin, browser,
 * or home PC. Unauthenticated by design (it's a way back IN), rate-limited, and
 * always answers "ok" so it can't be used to discover which accounts exist.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`recover:${clientIp(req)}`, 5, 300_000);
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

  await startDeviceRecovery(identifier, password);
  return apiOk({ ok: true });
}
