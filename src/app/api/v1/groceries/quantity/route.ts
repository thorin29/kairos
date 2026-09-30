import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setItemQuantityCore } from "@/lib/groceries-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set a line's quantity (1-99), or null/absent to clear it. */
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
  if (!id) return apiError("validation", "id is required.");
  const quantity = typeof body.quantity === "number" ? body.quantity : null;
  await setItemQuantityCore(id, quantity);
  return apiOk({ status: "ok" });
}
