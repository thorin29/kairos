import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { removeDayExtra } from "@/lib/workouts/day-extras-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Take a day extra off its day (v0.667). Body: { id } ("extra_…"). Anything
 *  logged for it stays logged. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (!b || typeof b.id !== "string" || !b.id) return apiError("validation", "Expected { id }.");
  await removeDayExtra(authed.device.person.id, b.id);
  return apiOk({ status: "ok" });
}
