import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { sharePlan } from "@/lib/workouts/plan-share-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Share the person's weekly plan (v0.618). Body: { name }. → { status:
 *  "pending" } waiting for a parent, or "shared" when a parent shared it (v0.624). */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await sharePlan(authed.device.person.id, typeof b?.name === "string" ? b.name : "");
  return r.ok ? apiOk({ status: r.status === "APPROVED" ? "shared" : "pending" }) : apiError("validation", r.error);
}
