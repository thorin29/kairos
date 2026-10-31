import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { concept2Day, syncConcept2 } from "@/lib/workouts/concept2-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Check Concept2 and return the day's rows. Body: { date, force? }. Without
 * `force` it only asks Concept2 when the last check is a few minutes old.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { date?: unknown; force?: unknown } | null;
  const date = typeof b?.date === "string" ? b.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError("validation", "date must be YYYY-MM-DD.");
  const userId = authed.device.person.id;
  const { added } = await syncConcept2(userId, b?.force === true);
  return apiOk({ added, ...(await concept2Day(userId, date)) });
}
