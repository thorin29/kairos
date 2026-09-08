import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { moveItemCore } from "@/lib/groceries-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Move a saved line to a different store. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const id = typeof body.id === "string" ? body.id : "";
  const storeId = typeof body.storeId === "string" ? body.storeId : "";
  if (!id || !storeId) return apiError("validation", "id and storeId are required.");
  await moveItemCore(id, storeId);
  return apiOk({ status: "ok" });
}
