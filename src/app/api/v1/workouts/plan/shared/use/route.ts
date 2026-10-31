import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { previewSharedPlan, useSharedPlan } from "@/lib/workouts/plan-share-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start from a household plan (v0.618). Body: { id, preview?: true, mode?:
 *  "replace" | "add" }; the same answers as workouts/plan/import. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id) return apiError("validation", "id is required.");
  const userId = authed.device.person.id;
  if (b?.preview === true) {
    const r = await previewSharedPlan(userId, id);
    return r.ok ? apiOk({ preview: r.preview }) : apiError("validation", r.error);
  }
  const r = await useSharedPlan(userId, id, b?.mode === "add" ? "add" : "replace");
  return r.ok ? apiOk({ status: "ok", added: r.added }) : apiError("validation", r.error);
}
