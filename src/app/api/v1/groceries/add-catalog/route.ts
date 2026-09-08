import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addFromCatalogCore } from "@/lib/groceries-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add straight from a catalog item — its remembered store unless one is given. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const catalogId = typeof body.catalogId === "string" ? body.catalogId : "";
  if (!catalogId) return apiError("validation", "catalogId is required.");
  const storeId = typeof body.storeId === "string" ? body.storeId : undefined;
  await addFromCatalogCore(catalogId, storeId, authed.device.person.id);
  return apiOk({ status: "ok" });
}
