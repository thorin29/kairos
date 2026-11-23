import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { requirePlacesViewer, sameSiteRequest } from "@/lib/places/embed-session";
import { addStop, canEditHistory, removeStop, undoStopEdit } from "@/lib/places/stop-edits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Day corrections from the app (v0.769), parents only:
 * `{ op: "remove", personId, start }`, `{ op: "undo", editId }`,
 * `{ op: "add", personId, from, to, lat, lng, name?, address? }`.
 */
export async function POST(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  if (!sameSiteRequest(req)) return apiError("forbidden", "Not allowed.");
  if (!(await canEditHistory(viewer.userId))) return apiError("forbidden", "Only parents can change history.");
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Invalid JSON.");
  }
  if (b.op === "remove") return apiOk(await removeStop(str(b.personId), str(b.start), viewer.userId));
  if (b.op === "undo") return apiOk(await undoStopEdit(str(b.editId)));
  if (b.op === "add") {
    return apiOk(
      await addStop({
        personId: str(b.personId),
        fromISO: str(b.from),
        toISO: str(b.to),
        lat: num(b.lat),
        lng: num(b.lng),
        name: str(b.name) || null,
        address: str(b.address) || null,
        byId: viewer.userId,
      }),
    );
  }
  return apiError("validation", "Unknown change.");
}
