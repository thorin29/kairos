import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { completeTripCore } from "@/lib/groceries-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Finish a trip: bought lines drop, the rest return to the saved list. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const tripId = typeof body.tripId === "string" ? body.tripId : "";
  if (!tripId) return apiError("validation", "tripId is required.");
  await completeTripCore(tripId);
  return apiOk({ status: "ok" });
}
