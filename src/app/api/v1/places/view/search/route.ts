import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { requirePlacesViewer, sameSiteRequest } from "@/lib/places/embed-session";
import { searchChoices } from "@/lib/places/naming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Not right?" in the app (v0.768): look up `?q=` near `?lat=&lng=`. */
export async function GET(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  if (!sameSiteRequest(req)) return apiError("forbidden", "Not allowed.");
  const q = req.nextUrl.searchParams;
  const r = Number(q.get("r"));
  return apiOk(await searchChoices(Number(q.get("lat")), Number(q.get("lng")), q.get("q") ?? "", Number.isFinite(r) && r > 0 ? r : undefined));
}
