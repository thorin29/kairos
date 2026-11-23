import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { requirePlacesViewer, sameSiteRequest } from "@/lib/places/embed-session";
import { nearbyChoices } from "@/lib/places/naming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Not right?" in the app (v0.768): businesses near `?lat=&lng=&acc=`. */
export async function GET(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  if (!sameSiteRequest(req)) return apiError("forbidden", "Not allowed.");
  const q = req.nextUrl.searchParams;
  const acc = q.get("acc");
  return apiOk({ choices: await nearbyChoices(Number(q.get("lat")), Number(q.get("lng")), acc ? Number(acc) : null) });
}
