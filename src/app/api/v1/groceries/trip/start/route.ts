import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { startTripCore } from "@/lib/groceries-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a shopping run for a store. Shopper defaults to the enrolled person
 *  (this is their phone); pass shopperId to shop on someone else's behalf. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const storeId = typeof body.storeId === "string" ? body.storeId : "";
  if (!storeId) return apiError("validation", "storeId is required.");
  const shopperId = typeof body.shopperId === "string" && body.shopperId
    ? body.shopperId
    : authed.device.person.id;
  const res = await startTripCore(storeId, shopperId);
  return apiOk({ ok: res.ok, reason: res.reason ?? null });
}
