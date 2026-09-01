import qrcode from "qrcode-generator";

/**
 * A self-contained SVG QR code for short text (enrollment codes). Built from the
 * qrcode-generator module matrix — dependency-free, no canvas, no raster — as a
 * single path of unit squares with the standard 4-module quiet zone, sized by
 * its container through the viewBox. `currentColor` lets it inherit the text
 * colour of wherever it's dropped. Error-correction level M. The input here is
 * always our own [A-Z2-9] code, so inlining the markup carries no injection
 * surface.
 */
export function qrSvg(text: string): string {
  const qr = qrcode(0, "M"); // 0 = auto-pick the smallest version that fits
  qr.addData(text);
  qr.make();

  const n = qr.getModuleCount();
  const margin = 4;
  const size = n + margin * 2;

  let path = "";
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) {
        path += `M${col + margin} ${row + margin}h1v1h-1z`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="Enrollment QR code">` +
    `<path d="${path}" fill="currentColor"/></svg>`
  );
}
