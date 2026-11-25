import "server-only";
import { SIZES, cleanKind, rematchAround } from "@/lib/places/visits";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { PLACES_LOOKUP_KEY } from "@/lib/places/config";
import { metres } from "@/lib/places/geo";
import { textSearch } from "@/lib/places/google";
import { bump, canCall } from "@/lib/places/usage";
import { bustPlaceMemo } from "@/lib/places/live";
import { candidatesNear } from "@/lib/places/resolve";
import { trackedIds } from "@/lib/places/tracks";

/**
 * "Not right?" (v0.768): the family says what a spot really is. Nearby
 * businesses Google already returned are offered first; anything can be
 * typed and looked up near the spot ("Lowe's", "the rink", an address), or
 * saved as typed ("Grandma's"). The choice is the family's name for that spot
 * from then on, for everyone or one person, and History re-labels with it.
 */

import type { PlaceChoice } from "@/lib/places/naming-types";
export type { PlaceChoice };

function usable(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Businesses near the spot (from what Google already said, or one Nearby Search). */
export async function nearbyChoices(lat: number, lng: number, accuracyM: number | null): Promise<PlaceChoice[]> {
  if (!usable(lat, lng)) return [];
  const rows = await candidatesNear({ lat, lng, accuracyM });
  return rows.map((c) => ({ name: c.name, address: c.address, placeId: null, lat: null, lng: null, distanceM: null }));
}

/** Look up what was typed near the spot. Limited per day like every Google call. */
export async function searchChoices(
  lat: number,
  lng: number,
  query: string,
  radiusM = 5000,
): Promise<{ choices: PlaceChoice[]; error: string | null }> {
  const q = query.trim().slice(0, 120);
  if (!q || !usable(lat, lng)) return { choices: [], error: null };
  const key = await getSetting(PLACES_LOOKUP_KEY);
  if (!key) return { choices: [], error: "Place search needs the lookup key in Admin." };
  if (!(await canCall("search"))) return { choices: [], error: "Today's place searches are used up. Save it as typed, or try tomorrow." };
  await bump("search");
  const hits = await textSearch(key, q, lat, lng, radiusM);
  if (hits == null) return { choices: [], error: "Couldn't reach Google. Try again." };
  return {
    choices: hits
      .map((h) => ({ name: h.name, address: h.address, placeId: h.placeId, lat: h.lat, lng: h.lng, distanceM: metres({ lat, lng }, h) }))
      .sort((a, b) => a.distanceM - b.distanceM),
    error: null,
  };
}

/** Save the family's name for a spot. The spot covers 100–250 m: far enough
 *  to reach the chosen place's own pin when Google gave one. */
export async function saveFamilyName(input: {
  lat: number;
  lng: number;
  name: string;
  address: string | null;
  placeId: string | null;
  placeLat: number | null;
  placeLng: number | null;
  forUserId: string | null;
  /** From the Places page (v0.795): home or business, and the place's size. */
  kind?: string | null;
  size?: keyof typeof SIZES | null;
}): Promise<{ error: string | null }> {
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Type a name." };
  if (!usable(input.lat, input.lng)) return { error: "That spot has no usable position." };
  if (input.forUserId && (await trackedIds([input.forUserId])).length === 0) return { error: "That person isn't tracked." };
  let radiusM = 120;
  if (input.placeLat != null && input.placeLng != null && usable(input.placeLat, input.placeLng)) {
    const d = metres({ lat: input.lat, lng: input.lng }, { lat: input.placeLat, lng: input.placeLng });
    radiusM = Math.round(Math.min(250, Math.max(100, d + 75)));
  }
  if (input.size && SIZES[input.size]) radiusM = SIZES[input.size];
  await prisma.placeName.create({
    data: {
      lat: input.lat,
      lng: input.lng,
      name,
      address: input.address?.trim().slice(0, 200) || null,
      googlePlaceId: input.placeId?.slice(0, 300) || null,
      userId: input.forUserId,
      radiusM,
      kind: cleanKind(input.kind),
    },
  });
  bustPlaceMemo();
  // Visits around it now belong to it (v0.795).
  await rematchAround({ lat: input.lat, lng: input.lng }, radiusM).catch((e) =>
    console.warn(`[visits] rematch failed: ${(e as Error).message}`),
  );
  return { error: null };
}
