import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { sharedPlansFor } from "@/lib/workouts/plan-share-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The household's plans (v0.618): approved ones, and the person's own still
 *  waiting. → { plans: [{ id, name, by, summary, status, mine }] } */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ plans: await sharedPlansFor(authed.device.person.id) });
}
