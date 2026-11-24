/** Shapes shared by the Places server code and the browser map. */

export type PlaceLabel = {
  name: string | null;
  address: string | null;
  kind: "saved" | "place" | "address" | "unknown";
};

export type LivePerson = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  /** ISO: the newest report. */
  at: string;
  battery: number | null;
  /** Speed in mph while moving (from the phone; null when it gave none). */
  mph: number | null;
  /** While moving: drive (≥10 mph), walk (<5 mph) or move (between). */
  motion: "drive" | "walk" | "move" | null;
  moving: boolean;
  /** ISO: arrived where they are (null while moving). */
  since: string | null;
  stale: boolean;
  place: PlaceLabel | null;
  /** On a backpacking trip today (v0.778). */
  backpacking?: boolean;
  /** The card's colour (v0.779): the zone's while settled in one, else coral;
   *  and the zone's icon (an SVG path, 24×24) when it has one. */
  look?: { color: string; icon: string | null; zone: string | null };
};

/** People without any location yet still appear in the list (not the map). */
export type WaitingPerson = { id: string; name: string; color: string; avatarPath: string | null; avatarPosition: string };

export type LiveData = { people: LivePerson[]; waiting: WaitingPerson[]; asOf: string };

