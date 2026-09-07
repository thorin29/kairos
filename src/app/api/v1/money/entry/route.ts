import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { canActForMoney } from "@/lib/queries/money";
import { addMoneyEntryCore } from "@/lib/money-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * File a deposit or payment (mirrors the web add overlay). Lands PENDING; the
 * balance moves immediately regardless — approval is the verification mark. A
 * child may file only for themselves; a parent/admin for anyone they can see.
 * Amount is whole cents on the wire, per the API's money convention.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const person = authed.device.person;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) return apiError("validation", "userId is required.");

  if (!(await canActForMoney(person, userId))) {
    return apiError("forbidden", "You can only do that for yourself.");
  }

  const direction = body.direction === "PAYMENT" ? "PAYMENT" : "DEPOSIT";
  const amountCents =
    typeof body.amountCents === "number" ? body.amountCents : NaN;
  const detail = typeof body.detail === "string" ? body.detail : null;
  const category = typeof body.category === "string" ? body.category : null;
  const dateISO = typeof body.date === "string" ? body.date : null;

  const res = await addMoneyEntryCore({
    userId,
    direction,
    amountCents,
    detail,
    category,
    dateISO,
  });
  if (!res.ok) return apiError("validation", res.error);

  return apiOk({ status: "ok" });
}
