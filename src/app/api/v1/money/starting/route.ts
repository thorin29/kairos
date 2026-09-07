import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setStartingFundsCore } from "@/lib/money-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set a person's starting-funds baseline (one per person). Admin device only. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  if (authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only an admin can set starting funds.");
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) return apiError("validation", "userId is required.");
  const res = await setStartingFundsCore({
    userId,
    amountCents: typeof body.amountCents === "number" ? body.amountCents : NaN,
    dateISO: typeof body.date === "string" ? body.date : null,
    adminId: authed.device.person.id,
  });
  if (!res.ok) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
