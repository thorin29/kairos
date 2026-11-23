import "server-only";

/**
 * The three Google calls Kairos makes, server-side with the lookup key:
 * Places API (New) Nearby Search (Pro SKU — only the fields that need), and
 * Geocoding reverse and forward (Essentials). Each returns null on any failure;
 * callers count usage and fall back.
 */

const TIMEOUT_MS = 6_000;

/** Types that describe an area or road rather than a place someone is at. */
const AREA_TYPES = new Set([
  "route",
  "locality",
  "political",
  "postal_code",
  "neighborhood",
  "sublocality",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "country",
  "street_address",
  "premise",
  "intersection",
]);

export type NearbyHit = {
  name: string;
  address: string | null;
  placeId: string;
  lat: number;
  lng: number;
};

type NearbyResponse = {
  places?: {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    types?: string[];
  }[];
};

/** Places within `radiusM` of the point, nearest first. [] = none found;
 *  null = the call failed. */
export async function nearbySearch(
  key: string,
  lat: number,
  lng: number,
  radiusM: number,
): Promise<NearbyHit[] | null> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify({
        maxResultCount: 5,
        rankPreference: "DISTANCE",
        languageCode: "en",
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusM } },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[places] nearby search failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as NearbyResponse;
    const hits: NearbyHit[] = [];
    for (const p of data.places ?? []) {
      const name = p.displayName?.text?.trim();
      const plat = p.location?.latitude;
      const plng = p.location?.longitude;
      if (!name || !p.id || plat == null || plng == null) continue;
      if ((p.types ?? []).length > 0 && (p.types ?? []).every((t) => AREA_TYPES.has(t))) continue;
      hits.push({ name, address: p.formattedAddress ?? null, placeId: p.id, lat: plat, lng: plng });
    }
    return hits;
  } catch (e) {
    console.warn(`[places] nearby search error: ${(e as Error).name}`);
    return null;
  }
}

/** What someone typed ("Lowe's", "the rink", an address), searched near a
 *  point — Places API (New) Text Search, Pro SKU fields. null = the call failed. */
export async function textSearch(
  key: string,
  query: string,
  lat: number,
  lng: number,
): Promise<NearbyHit[] | null> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 6,
        languageCode: "en",
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[places] text search failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as NearbyResponse;
    const hits: NearbyHit[] = [];
    for (const p of data.places ?? []) {
      const name = p.displayName?.text?.trim();
      const plat = p.location?.latitude;
      const plng = p.location?.longitude;
      if (!name || !p.id || plat == null || plng == null) continue;
      hits.push({ name, address: p.formattedAddress ?? null, placeId: p.id, lat: plat, lng: plng });
    }
    return hits;
  } catch (e) {
    console.warn(`[places] text search error: ${(e as Error).name}`);
    return null;
  }
}

type GeocodeResponse = {
  status?: string;
  results?: { formatted_address?: string; place_id?: string; geometry?: { location?: { lat?: number; lng?: number } } }[];
};

async function geocode(params: string): Promise<GeocodeResponse | null> {
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[places] geocode failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as GeocodeResponse;
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn(`[places] geocode status ${data.status}`);
      return null;
    }
    return data;
  } catch (e) {
    console.warn(`[places] geocode error: ${(e as Error).name}`);
    return null;
  }
}

/** The street address at a point. `{ address: null }` = nothing there;
 *  null = the call failed. */
export async function reverseGeocode(
  key: string,
  lat: number,
  lng: number,
): Promise<{ address: string | null; placeId: string | null } | null> {
  // A building's own address first; any address only if there's none.
  const exact = await geocode(
    `latlng=${lat},${lng}&result_type=street_address|premise&language=en&key=${encodeURIComponent(key)}`,
  );
  if (!exact) return null;
  let r = exact.results?.[0];
  if (!r) {
    const any = await geocode(`latlng=${lat},${lng}&language=en&key=${encodeURIComponent(key)}`);
    if (!any) return null;
    r = any.results?.[0];
  }
  return { address: r?.formatted_address ?? null, placeId: r?.place_id ?? null };
}

/** Coordinates for a typed address. `{ found: false }` = no match; null = the
 *  call failed. */
export async function forwardGeocode(
  key: string,
  address: string,
): Promise<{ found: true; lat: number; lng: number } | { found: false } | null> {
  const data = await geocode(`address=${encodeURIComponent(address)}&language=en&key=${encodeURIComponent(key)}`);
  if (!data) return null;
  const loc = data.results?.[0]?.geometry?.location;
  if (loc?.lat == null || loc?.lng == null) return { found: false };
  return { found: true, lat: loc.lat, lng: loc.lng };
}
