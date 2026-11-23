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
};

export type DayLegItem = {
  kind: "drive" | "move";
  /** drive, walk (averaging under 5 mph) or move (in between). */
  motion: "drive" | "walk" | "move";
  start: string;
  end: string;
  /** What to draw: the road-snapped path, or the raw points. */
  path: [number, number][];
  snapped: boolean;
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
};
