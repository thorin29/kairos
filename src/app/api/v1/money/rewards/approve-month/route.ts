import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { approveBibleMonthAllCore } from "@/lib/bible-rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve a whole month's Bible-reading rewards (base for every unpaid finisher,
 * plus the group bonus when everyone finished in time). Admin device only — the
 * device token proves the parent's identity, so no PIN. Eligibility is re-checked
 * server-side in the core; idempotent on repeat.
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

  const periodKey = typeof body.periodKey === "string" ? body.periodKey : "";
  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    return apiError("validation", "periodKey must be YYYY-MM.");
  }

  await approveBibleMonthAllCore(periodKey, authed.device.person.id);
  return apiOk({ status: "ok" });
}
