import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { savePlan, savedPlansFor } from "@/lib/workouts/plan-share-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** My plans (v0.620): the caller's saved plans, newest first.
 *  → { plans: [{ id, name, summary, savedOn }] }. Open one with
 *  workouts/plan/shared/use. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ plans: await savedPlansFor(authed.device.person.id) });
}

/** Save the current plan to My plans. Body: { name } → { status: "ok", id }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const r = await savePlan(authed.device.person.id, typeof b?.name === "string" ? b.name : "");
  return r.ok ? apiOk({ status: "ok", id: r.id }) : apiError("validation", r.error);
}
