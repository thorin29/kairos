import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requirePlacesViewer } from "@/lib/places/embed-session";
import { todaysTracks } from "@/lib/places/tracks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Today's tracks for `?ids=a,b` (v0.762), for the app's Places WebView. */
export async function GET(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  return apiOk({ tracks: await todaysTracks(ids) });
}
