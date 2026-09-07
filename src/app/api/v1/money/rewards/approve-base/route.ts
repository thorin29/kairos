import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { approveBibleBaseCore } from "@/lib/bible-rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve one person's base Bible-reading reward for a finished month. Admin
 * device only (no PIN — the device token proves identity). The month-finished
 * re-check lives in the shared core; idempotent on repeat.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  if (authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only an admin can approve rewards.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const periodKey = typeof body.periodKey === "string" ? body.periodKey : "";
  if (!userId) return apiError("validation", "userId is required.");
  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    return apiError("validation", "periodKey must be YYYY-MM.");
  }

  await approveBibleBaseCore(userId, periodKey, authed.device.person.id);
  return apiOk({ status: "ok" });
}
