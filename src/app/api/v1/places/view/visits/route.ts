import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { requirePlacesViewer, sameSiteRequest } from "@/lib/places/embed-session";
import { canEditHistory } from "@/lib/places/stop-edits";
import { canConfirmEverything, chooseForVisit, confirmSpot, moveVisit, searchVisits, stoppedAt, updatePlace, SIZES } from "@/lib/places/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const size = (v: unknown): keyof typeof SIZES => (v === "small" || v === "large" ? v : "normal");

/**
 * Places page (v0.795): search the family's visits. Reads Kairos's own visit
 * records only. `?q=&users=a,b&since=YYYY-MM-DD&until=YYYY-MM-DD&place=<key>&offset=`.
 */
export async function GET(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  const u = req.nextUrl.searchParams;
  const since = u.get("since");
  const until = u.get("until");
  return apiOk(
    await searchVisits({
      q: u.get("q") ?? "",
      userIds: (u.get("users") ?? "").split(",").filter(Boolean),
      sinceISO: since && ISO.test(since) ? since : null,
      untilISO: until && ISO.test(until) ? until : null,
      placeKey: u.get("place"),
      offset: Number(u.get("offset") ?? 0) || 0,
    }),
  );
}

/**
 * Changes from the Places page (v0.795):
 * `{ op: "confirm", spotId, kind?, size?, lat?, lng? }` (someone who stopped there, a
 * parent, or someone allowed to confirm everyone's places; v0.812 `kind` is a
 * place type, which sets the size);
 * parents only: `{ op: "choose", visitId, placeNameId }` ("Which one?"),
 * `{ op: "move", visitId, name, address?, placeId?, lat?, lng? }`,
 * `{ op: "update", placeNameId, name?, kind?, size?, lat?, lng? }`. v0.812.1: lat/lng
 * move the place's centre (up to 400 m).
 */
export async function POST(req: NextRequest) {
  const viewer = await requirePlacesViewer(req);
  if ("response" in viewer) return viewer.response;
  if (!sameSiteRequest(req)) return apiError("forbidden", "Not allowed.");
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Invalid JSON.");
  }
  if (b.op === "confirm") {
    // Only someone who stopped there, a parent, or someone an admin allowed (v0.812).
    const spotId = str(b.spotId);
    const parent = await canEditHistory(viewer.userId);
    if (!(await canConfirmEverything(viewer.userId, parent)) && !(await stoppedAt(viewer.userId, spotId))) {
      return apiOk({ error: "Only people who stopped here can confirm it." });
    }
    return apiOk(await confirmSpot(spotId, str(b.kind) || null, size(b.size), { lat: numOrNull(b.lat), lng: numOrNull(b.lng) }));
  }
  if (!(await canEditHistory(viewer.userId))) return apiError("forbidden", "Only parents can change places.");
  if (b.op === "choose") return apiOk(await chooseForVisit(str(b.visitId), str(b.placeNameId)));
  if (b.op === "move") {
    return apiOk(
      await moveVisit(str(b.visitId), {
        name: str(b.name),
        address: str(b.address) || null,
        placeId: str(b.placeId) || null,
        lat: numOrNull(b.lat),
        lng: numOrNull(b.lng),
      }),
    );
  }
  if (b.op === "update") {
    return apiOk(
      await updatePlace(str(b.placeNameId), {
        ...(typeof b.name === "string" ? { name: b.name } : {}),
        ...("kind" in b ? { kind: str(b.kind) || null } : {}),
        ...(b.size ? { size: size(b.size) } : {}),
        lat: numOrNull(b.lat),
        lng: numOrNull(b.lng),
      }),
    );
  }
  return apiError("validation", "Unknown change.");
}
