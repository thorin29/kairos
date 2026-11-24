import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requirePlacesViewer } from "@/lib/places/embed-session";
import { takeMapLoad } from "@/lib/places/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Counts a map the app's Places WebView is about to open (Google bills per
 *  map load); { ok: false } when today's map loads are used up (v0.778). */
export async function POST(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  return apiOk({ ok: await takeMapLoad() });
}
