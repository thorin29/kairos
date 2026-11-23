import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requirePlacesViewer } from "@/lib/places/embed-session";
import { loadLive, placesEnabled } from "@/lib/places/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everyone's position for the app's Places WebView (v0.762); same data as `/places/live`. */
export async function GET(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  if (!(await placesEnabled())) return apiOk({ state: "off" });
  return apiOk({ state: "ok", ...(await loadLive()) });
}
