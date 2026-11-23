import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requirePlacesViewer } from "@/lib/places/embed-session";
import { bump } from "@/lib/places/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Counts a map the app's Places WebView opened (Google bills per map load). */
export async function POST(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  await bump("mapload");
  return apiOk({ ok: true });
}
