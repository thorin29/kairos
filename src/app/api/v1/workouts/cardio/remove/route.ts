import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { cardioDay, removeCardio } from "@/lib/workouts/cardio-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Remove a cardio entry (a Concept2 row then stays out). Body: { date, sessionId }.
 *  Safe to replay. Returns the day's cardio. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { date?: unknown; sessionId?: unknown } | null;
  const date = typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  const sessionId = typeof b?.sessionId === "string" ? b.sessionId : "";
  if (!date || !sessionId) return apiError("validation", "date and sessionId are required.");
  const userId = authed.device.person.id;
  await removeCardio(userId, sessionId);
  return apiOk({ date, cardio: await cardioDay(userId, date) });
}
