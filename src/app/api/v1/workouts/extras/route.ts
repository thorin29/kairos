import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addDayExtra } from "@/lib/workouts/day-extras-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add to one day only from "+ Additional" (v0.667). Body: { date, kind, ref }
 *  — kind "mobility" or "stretching" with a routine id, or "iso" with an
 *  isometric workout id. The same one twice is one. → { status, id }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  if (!date) return apiError("validation", "date is required.");
  const r = await addDayExtra(authed.device.person.id, date, b?.kind, b?.ref);
  if (!r.ok) return apiError("validation", r.error);
  return apiOk({ status: "ok", id: r.id });
}
