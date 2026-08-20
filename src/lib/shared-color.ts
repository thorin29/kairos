// How a shared event (two or more people) paints its colours: either vertical
// bands, one per person, or a single blended hue. The blend mixes on the colour
// wheel (circular mean of hue, kept saturated) rather than averaging raw RGB —
// averaging red and blue in RGB muddies toward grey/brown, whereas the wheel
// mean lands on a vivid purple. That's the "avoid brown" trick.

export type SharedStyle = "bands" | "blend";

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToCss(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(
    l * 100,
  )}%)`;
}

/** A single mixed colour from several, mixed on the hue wheel so complementary
 *  colours meet at a vivid hue instead of muddy brown. */
export function blendColors(colors: string[]): string {
  const hsls = colors
    .map(hexToRgb)
    .filter((c): c is [number, number, number] => c !== null)
    .map(([r, g, b]) => rgbToHsl(r, g, b));
  if (hsls.length === 0) return colors[0] ?? "#888888";
  if (hsls.length === 1) return colors[0];

  // Circular mean of hue, weighted by saturation so near-grey inputs don't drag
  // the result toward an arbitrary hue.
  let x = 0;
  let y = 0;
  let sSum = 0;
  let lSum = 0;
  for (const [h, s, l] of hsls) {
    const w = 0.15 + s; // keep a floor so all colours count a little
    x += Math.cos(h * 2 * Math.PI) * w;
    y += Math.sin(h * 2 * Math.PI) * w;
    sSum += s;
    lSum += l;
  }
  let h = Math.atan2(y, x) / (2 * Math.PI);
  if (h < 0) h += 1;
  // Keep it saturated and mid-light so the blend reads as a real colour, never
  // brown (brown is just dark, desaturated orange).
  const s = Math.min(0.85, Math.max(0.5, sSum / hsls.length));
  const l = Math.min(0.6, Math.max(0.42, lSum / hsls.length));
  return hslToCss(h, s, l);
}

/** Vertical hard-edged stripes, one per colour. */
export function bandsGradient(colors: string[]): string {
  const n = colors.length;
  const stops = colors
    .map((c, i) => `${c} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`)
    .join(", ");
  return `linear-gradient(90deg, ${stops})`;
}

/** A style object for a shared block. For a single colour it's a plain fill; for
 *  several it's bands or a blend per the household setting. Returns
 *  `backgroundImage` for bands (leaving backgroundColor as a solid fallback) and
 *  `backgroundColor` otherwise. */
export function sharedBackground(
  colors: string[],
  style: SharedStyle,
): { backgroundColor?: string; backgroundImage?: string } {
  const uniq = Array.from(new Set(colors.filter(Boolean)));
  if (uniq.length <= 1) return { backgroundColor: uniq[0] ?? "#888888" };
  if (style === "blend") return { backgroundColor: blendColors(uniq) };
  return { backgroundColor: uniq[0], backgroundImage: bandsGradient(uniq) };
}
