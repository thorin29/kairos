import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { renameSavedPlan } from "@/lib/workouts/plan-share-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rename a saved plan (v0.620). Body: { id, name }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { id?: unknown; name?: unknown } | null;
  if (typeof b?.id !== "string" || !b.id) return apiError("validation", "id is required.");
  const r = await renameSavedPlan(authed.device.person.id, b.id, typeof b.name === "string" ? b.name : "");
  return r.ok ? apiOk({ status: "ok" }) : apiError("validation", r.error);
}
