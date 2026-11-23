/** A choice for "Not right?" (shared with the browser). */
export type PlaceChoice = {
  name: string;
  address: string | null;
  placeId: string | null;
  /** Where Google puts it, when known; sizes the saved spot. */
  lat: number | null;
  lng: number | null;
  /** From the person's spot, for telling choices apart. */
  distanceM: number | null;
};
