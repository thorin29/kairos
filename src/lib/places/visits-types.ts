/** Places page (v0.795): shapes shared by the server and the page. */

export type PlaceVisitRow = {
  id: string;
  arrivedAt: string;
  leftAt: string;
  lat: number;
  lng: number;
  person: { id: string; name: string; color: string; avatarPath: string | null; avatarPosition: string };
  /** The place's name: a zone, the family's name, or Google's while it's under 30 days old. */
  place: string | null;
  address: string | null;
  confirmed: boolean;
  /** "name:<id>", "spot:<id>" or "zone:<name>". */
  placeKey: string | null;
  /** Set when the stop fell inside two places ("Which one?"). */
  choices: { id: string; name: string | null }[] | null;
};

export type VisitSearch = { visits: PlaceVisitRow[]; total: number; more: boolean };

export type PlacesListRow = {
  key: string;
  name: string;
  address: string | null;
  confirmed: boolean;
  /** "Home", "Business", "Named", "Zone", or "" when unconfirmed. */
  kind: string;
  /** The stored type key (v0.812), for the Place type field. */
  type: string | null;
  visits: number;
  last: string | null;
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
  /** Named for one person only. */
  justOne: boolean;
  /** Who stopped at an unconfirmed spot (v0.813), for parents and anyone who
   *  confirms everyone's places, so they can ask. */
  who?: string[];
};

export type PlacesList = { rows: PlacesListRow[]; toConfirm: number; whichOne: number };

/**
 * What a place is (v0.812), each with how far it reaches: a type sets the
 * place's size. Feet are what's shown; metres are what's stored. Estimates
 * from a typical building and its parking.
 */
export const PLACE_TYPES = [
  { key: "home", label: "Home or small shop", ft: 130 },
  { key: "shop", label: "Shop or restaurant", ft: 200 },
  { key: "grocery", label: "Grocery store", ft: 400 },
  { key: "school", label: "School or church", ft: 500 },
  { key: "sports", label: "Rink, gym or field", ft: 500 },
  { key: "bigbox", label: "Big-box store", ft: 600 },
  { key: "park", label: "Park", ft: 650 },
  { key: "campus", label: "Stadium, mall or campus", ft: 1300 },
] as const;
export type PlaceTypeKey = (typeof PLACE_TYPES)[number]["key"];
export const placeType = (k: string | null | undefined) => PLACE_TYPES.find((t) => t.key === k) ?? null;
export const typeRadiusM = (k: string | null | undefined): number | null => {
  const t = placeType(k);
  return t ? Math.round(t.ft * 0.3048) : null;
};
/** A stored place's type label; the old "business" reads as before. */
export const typeLabel = (k: string | null | undefined): string =>
  placeType(k)?.label ?? (k === "business" ? "Business" : "Named");
