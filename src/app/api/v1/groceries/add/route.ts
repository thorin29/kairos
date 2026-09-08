import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addItemCore } from "@/lib/groceries-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add a needed item to a store's list, attributed to the enrolled person. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const name = typeof body.name === "string" ? body.name : "";
  const storeId = typeof body.storeId === "string" ? body.storeId : "";
  if (!name.trim() || !storeId) return apiError("validation", "name and storeId are required.");
  const note = typeof body.note === "string" ? body.note : null;
  await addItemCore({ name, storeId, note, requesterId: authed.device.person.id });
  return apiOk({ status: "ok" });
}
