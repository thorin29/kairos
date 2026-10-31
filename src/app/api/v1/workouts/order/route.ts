import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadDayOrders, saveDayOrder } from "@/lib/workouts/day-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The day page's section order: every day's, and weekdays with their own (v0.615). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk(await loadDayOrders(authed.device.person.id));
}

/** Body: { day: 0-6 | null (every day), order: [kind…] | null (reset) }. Returns the orders. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { day?: unknown; order?: unknown } | null;
  const day = b?.day == null ? null : typeof b.day === "number" && Number.isInteger(b.day) && b.day >= 0 && b.day <= 6 ? b.day : NaN;
  if (Number.isNaN(day)) return apiError("validation", "day must be 0..6 or null.");
  if (b?.order != null && !Array.isArray(b.order)) return apiError("validation", "order must be a list or null.");
  const userId = authed.device.person.id;
  await saveDayOrder(userId, day as number | null, b?.order ?? null);
  return apiOk(await loadDayOrders(userId));
}
