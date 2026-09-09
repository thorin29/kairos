import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { joinCheck } from "@/lib/api/device-auth";
import { clientIp } from "@/lib/api/request";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tells the app's join screen whether an invite is valid and whether the
 * account already has a password (so it shows "create" vs "confirm"). Public,
 * rate-limited, and reveals nothing beyond that.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`join-check:${clientIp(req)}`, 30, 60_000);
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
  return apiOk(await joinCheck(token));
}
