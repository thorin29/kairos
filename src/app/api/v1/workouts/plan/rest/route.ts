import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addPlannedRestDayCore } from "@/lib/workouts/plan-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mark a weekday as a planned rest day. Body: { day: 0..6 }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const body = (await req.json().catch(() => null)) as { day?: number } | null;
  const day = typeof body?.day === "number" ? body.day : NaN;
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    return apiError("validation", "day must be 0..6.");
  }
  await addPlannedRestDayCore(authed.device.person.id, day);
  return apiOk({ day, status: "ok" });
}
