import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { approveMoneyEntryCore } from "@/lib/money-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mark a filed transaction verified. Admin device only (no PIN). */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  if (authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only an admin can approve transactions.");
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return apiError("validation", "id is required.");
  await approveMoneyEntryCore(id, authed.device.person.id);
  return apiOk({ status: "ok" });
}
