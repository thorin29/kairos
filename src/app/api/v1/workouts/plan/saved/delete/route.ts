import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { deleteSavedPlan } from "@/lib/workouts/plan-share-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Delete a saved plan (v0.620). Body: { id }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof b?.id !== "string" || !b.id) return apiError("validation", "id is required.");
  await deleteSavedPlan(authed.device.person.id, b.id);
  return apiOk({ status: "ok" });
}
