"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { DayItem } from "@/lib/places/history-types";

/** Shared by the live map and History: load Google Maps once, draw tracks. */

let optionsSet = false;
export function loadMaps(key: string) {
  if (!optionsSet) {
    setOptions({ key, v: "weekly" });
    optionsSet = true;
  }
  return Promise.all([importLibrary("maps"), importLibrary("marker")]);
}

/** On a phone the page scrolls past the map, so one finger scrolls the page
 *  and two move the map; full screen (and a mouse) moves the map directly. */
export function touchInline(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Lines for a day's trips: drives solid (thicker when road-snapped, faded
 * while still under way), walks and other slow trips dotted, workouts tracked
 * in the app in thin short dashes. Stops aren't lines.
 */
/** How far (px) a dashed walk is drawn beside its path, so there and back don't overlap. */
const KEEP_RIGHT = 2.5;

export function drawTrips(map: google.maps.Map, items: DayItem[], color: string): google.maps.Polyline[] {
  const lines: google.maps.Polyline[] = [];
  for (const it of items) {
    if (it.kind === "stop" || it.path.length < 2) continue;
    const path = it.path.map(([lat, lng]) => ({ lat, lng }));
    if (it.motion === "workout") {
      // A walk, run, ruck or hike tracked in the app: thin short dashes.
      lines.push(
        new google.maps.Polyline({
          map,
          path,
          clickable: false,
          strokeOpacity: 0,
          zIndex: 3,
          icons: [
            {
              // Drawn a little to the right of the way it went (v0.813), so an
              // out-and-back shows two dashed lines side by side instead of
              // the two sets of dashes filling each other in.
              icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: color, strokeWeight: 2, scale: 2, anchor: new google.maps.Point(KEEP_RIGHT / 2, 0) },
              offset: "0",
              repeat: "7px",
            },
          ],
        }),
      );
    } else if (it.kind === "drive") {
      lines.push(
        new google.maps.Polyline({
          map,
          path,
          clickable: false,
          strokeColor: color,
          // Still under way: faded until it ends and is drawn on roads.
          strokeOpacity: it.live ? 0.4 : it.snapped ? 0.9 : 0.75,
          strokeWeight: it.snapped ? 5 : 4,
          zIndex: 2,
        }),
      );
    } else {
      lines.push(
        new google.maps.Polyline({
          map,
          path,
          clickable: false,
          strokeOpacity: 0,
          zIndex: 1,
          icons: [
            {
              icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: color, scale: 3, anchor: new google.maps.Point(KEEP_RIGHT / 3, 0) },
              offset: "0",
              repeat: "10px",
            },
          ],
        }),
      );
    }
  }
  return lines;
}
