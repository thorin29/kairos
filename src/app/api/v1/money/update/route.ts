import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { updateMoneyEntryCore } from "@/lib/money-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Edit a transaction in place (date, type, category/detail, amount). Admin only. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  if (authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only an admin can edit transactions.");
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return apiError("validation", "id is required.");
  const res = await updateMoneyEntryCore({
    id,
    direction: body.direction === "PAYMENT" ? "PAYMENT" : "DEPOSIT",
    amountCents: typeof body.amountCents === "number" ? body.amountCents : NaN,
    detail: typeof body.detail === "string" ? body.detail : null,
    category: typeof body.category === "string" ? body.category : null,
    dateISO: typeof body.date === "string" ? body.date : null,
  });
  if (!res.ok) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
