import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { exportWorkouts } from "@/lib/workouts/plan-share-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The person's workouts file (v0.618): their weekly plan and section order,
 * their own named workouts (and shared ones the plan uses), and with
 * `?history=1` everything they've logged. Names only, no ids.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const history = req.nextUrl.searchParams.get("history") === "1";
  return apiOk(await exportWorkouts(authed.device.person.id, { history }));
}
