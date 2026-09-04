import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { copyDayPlanCore } from "@/lib/workouts/plan-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Copy one day's plan to another. Body: { from: 0..6, to: 0..6 }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const body = (await req.json().catch(() => null)) as { from?: number; to?: number } | null;
  const from = typeof body?.from === "number" ? body.from : NaN;
  const to = typeof body?.to === "number" ? body.to : NaN;
  if (![from, to].every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    return apiError("validation", "from/to must be 0..6.");
  }
  await copyDayPlanCore(authed.device.person.id, from, to);
  return apiOk({ status: "ok" });
}
