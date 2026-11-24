/**
 * Elevation gain and loss for a day's hiking (v0.779). Pure, for the tests;
 * the Google call is in elevation.ts.
 */

/** Google's encoded polyline format. */
export function encodePolyline(pts: [number, number][]): string {
  let out = "";
  let pLat = 0;
  let pLng = 0;
  const enc = (v: number) => {
    let x = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (x >= 0x20) {
      s += String.fromCharCode((0x20 | (x & 0x1f)) + 63);
      x >>= 5;
    }
    return s + String.fromCharCode(x + 63);
  };
  for (const [lat, lng] of pts) {
    const a = Math.round(lat * 1e5);
    const b = Math.round(lng * 1e5);
    out += enc(a - pLat) + enc(b - pLng);
    pLat = a;
    pLng = b;
  }
  return out;
}

/** At most `max` points, evenly spread, the last one kept. */
export function sample<T>(pts: T[], max: number): T[] {
  if (pts.length <= max) return pts;
  const step = pts.length / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max - 1; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts[pts.length - 1]);
  return out;
}

/** Climbs and drops smaller than this are terrain noise, not hiking. */
const STEP_M = 3;

/** Total up and down along a line of heights (metres), ignoring wobble. */
export function gainLoss(heights: number[]): { gainM: number; lossM: number } {
  let gainM = 0;
  let lossM = 0;
  if (heights.length === 0) return { gainM, lossM };
  let ref = heights[0];
  for (const h of heights.slice(1)) {
    if (h - ref >= STEP_M) {
      gainM += h - ref;
      ref = h;
    } else if (ref - h >= STEP_M) {
      lossM += ref - h;
      ref = h;
    }
  }
  return { gainM: Math.round(gainM), lossM: Math.round(lossM) };
}

/** "\u2191 1,240 ft \u2193 1,180 ft", stored in a session's notes (shown with its cardio). */
export function elevationNote(gainM: number, lossM: number): string {
  const ft = (m: number) => Math.round(m * 3.28084).toLocaleString("en-US");
  return `\u2191 ${ft(gainM)} ft \u2193 ${ft(lossM)} ft`;
}

/** Whether a session's notes are that elevation line. */
export function isElevationNote(notes: string | null | undefined): notes is string {
  return !!notes && notes.startsWith("\u2191 ");
}
