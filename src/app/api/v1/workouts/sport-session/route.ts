import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { editSportSessionCore } from "@/lib/sport/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Change a calendar-confirmed session (v0.656): { sessionId, minutes?, effort?, hurt? }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return apiError("validation", "Expected a JSON body.");
  const ok = await editSportSessionCore(authed.device.person.id, { sessionId: b.sessionId, minutes: b.minutes, effort: b.effort, hurt: b.hurt });
  return ok ? apiOk({ status: "ok" }) : apiError("not_found", "That session isn't yours to change.");
}
