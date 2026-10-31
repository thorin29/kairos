import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { removeSharedPlan } from "@/lib/workouts/plan-share-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Take back one of the person's shared plans still waiting (v0.618). Body: { id }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id) return apiError("validation", "id is required.");
  await removeSharedPlan(id, authed.device.person.id);
  return apiOk({ status: "ok" });
}
