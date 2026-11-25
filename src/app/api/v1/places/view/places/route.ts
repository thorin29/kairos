import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requirePlacesViewer } from "@/lib/places/embed-session";
import { listPlaces } from "@/lib/places/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Places page (v0.795): every place with visits, for "All places". */
export async function GET(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  return apiOk(await listPlaces());
}
