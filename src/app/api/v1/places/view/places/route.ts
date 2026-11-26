import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requirePlacesViewer } from "@/lib/places/embed-session";
import { canEditHistory } from "@/lib/places/stop-edits";
import { canConfirmEverything, listPlaces } from "@/lib/places/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Places page (v0.795): every place with visits, for "All places". v0.812:
 * `?from=&to=` count only visits in those days; someone who can't confirm
 * everyone's places sees only the unconfirmed spots they stopped at.
 */
export async function GET(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  const u = req.nextUrl.searchParams;
  const from = u.get("from");
  const to = u.get("to");
  const everything = await canConfirmEverything(viewer.userId, await canEditHistory(viewer.userId));
  return apiOk(
    await listPlaces({
      viewerId: viewer.userId,
      everything,
      fromISO: from && ISO.test(from) ? from : null,
      toISO: to && ISO.test(to) ? to : null,
    }),
  );
}
