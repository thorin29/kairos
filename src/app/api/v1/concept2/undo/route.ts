import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { undoConcept2 } from "@/lib/workouts/concept2-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Put back rowing entered by hand that a Concept2 row replaced. Body: { resultId }.
 *  Saying it twice is harmless. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { resultId?: unknown } | null;
  const resultId = typeof b?.resultId === "string" ? b.resultId.slice(0, 40) : "";
  if (!resultId) return apiError("validation", "resultId is required.");
  await undoConcept2(authed.device.person.id, resultId);
  return apiOk({ status: "ok" });
}
