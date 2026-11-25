import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { requirePlacesViewer, sameSiteRequest } from "@/lib/places/embed-session";
import { saveFamilyName } from "@/lib/places/naming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : null);

/** "Not right?" in the app (v0.768): save the family's name for a spot. */
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
  const lat = num(b.lat);
  const lng = num(b.lng);
  if (lat == null || lng == null) return apiError("validation", "That spot has no usable position.");
  return apiOk(
    await saveFamilyName({
      lat,
      lng,
      name: str(b.name) ?? "",
      address: str(b.address),
      placeId: str(b.placeId),
      placeLat: num(b.placeLat),
      placeLng: num(b.placeLng),
      forUserId: str(b.forUserId),
      kind: str(b.kind),
      size: b.size === "small" || b.size === "normal" || b.size === "large" ? b.size : null,
    }),
  );
}
