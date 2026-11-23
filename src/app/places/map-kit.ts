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
 * Lines for a day's trips: drives solid (thicker when road-snapped), walks
 * and other slow trips dotted. Stops aren't lines.
 */
export function drawTrips(map: google.maps.Map, items: DayItem[], color: string): google.maps.Polyline[] {
  const lines: google.maps.Polyline[] = [];
  for (const it of items) {
    if (it.kind === "stop" || it.path.length < 2) continue;
    const path = it.path.map(([lat, lng]) => ({ lat, lng }));
    if (it.kind === "drive") {
      lines.push(
        new google.maps.Polyline({
          map,
          path,
          clickable: false,
          strokeColor: color,
          strokeOpacity: it.snapped ? 0.9 : 0.75,
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
              icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: color, scale: 3 },
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
