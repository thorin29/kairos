import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { getMonthGoalDays } from "@/lib/settings";
import { scoringGuide } from "@/lib/scoring/guide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "How scoring works" for the app's Settings: the same sections as /scoring. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ sections: scoringGuide({ monthTarget: await getMonthGoalDays() }) });
}
