import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { approveAllMoneyCore } from "@/lib/money-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Approve every outstanding transaction in one go. Admin device only. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  if (authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only an admin can approve transactions.");
  }
  await approveAllMoneyCore(authed.device.person.id);
  return apiOk({ status: "ok" });
}
