import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadReadingGoalItems } from "@/lib/queries/reading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The reading action items for the enrolled person's reading button: the current
 *  goal per book, plus any later goal already inside its reminder lead. Empty when
 *  there are no live goals, so the button can hide itself. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const items = await loadReadingGoalItems(authed.device.person.id);
  return apiOk({ items });
}
