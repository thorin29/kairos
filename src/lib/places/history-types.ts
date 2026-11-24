import type { PlaceLabel } from "@/lib/places/live-types";

/** Shapes shared by the Places history server code and the browser. */

export type DayStopItem = {
  kind: "stop";
  /** 1-based number on the map and in the timeline. */
  n: number;
  start: string;
  end: string;
  lat: number;
  lng: number;
  place: PlaceLabel | null;
  /** Set when the family added this stop (v0.769); removing it deletes the edit. */
  editId?: string | null;
  /** The phone went quiet here mid-trip (v0.777): last seen, not a visit. */
  lastSeen?: boolean;
};

/** A recorded stop the family removed (v0.769), so it can be put back. */
export type DayRemovedStop = { editId: string; start: string; end: string; place: PlaceLabel | null };

export type DayLegItem = {
  kind: "drive" | "move";
  /** drive, walk (averaging under 5 mph), move (in between), or a walk, run,
   *  ruck or hike tracked as a workout in the app (v0.777). */
  motion: "drive" | "walk" | "move" | "workout";
  /** For a workout: "Run", "Ruck", … */
  activity?: string;
  start: string;
  end: string;
  /** What to draw: the road-snapped path, or the raw points. */
  path: [number, number][];
  snapped: boolean;
  /** A drive still under way (v0.777), drawn faded until it ends. */
  live?: boolean;
  distanceM: number;
  topMph: number | null;
  /** The raw points and their times (ms), for replay. */
  raw: [number, number][];
  times: number[];
};

export type DayItem = DayStopItem | DayLegItem;

export type DayData = {
  date: string;
  items: DayItem[];
  totals: { miles: number; driveMin: number; topMph: number | null; stops: number };
  removed?: DayRemovedStop[];
  /** v0.790: where they were last seen before this day, so a day with
   *  nothing recorded opens there instead of on the whole country. */
  lastSeen?: { lat: number; lng: number } | null;
};
