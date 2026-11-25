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
  visits: number;
  last: string | null;
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
  /** Named for one person only. */
  justOne: boolean;
};

export type PlacesList = { rows: PlacesListRow[]; toConfirm: number; whichOne: number };
