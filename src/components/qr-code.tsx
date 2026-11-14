"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** A QR code drawn as SVG squares (v0.719): no images, no innerHTML. Dark on
 *  white with a quiet margin, so phone cameras read it in either theme. */
export function QrCode({ text, size = 200, label }: { text: string; size?: number; label: string }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const dark: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push([r, c]);
    return { n, dark };
  }, [text]);
  const m = 4;
  const total = cells.n + m * 2;
  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="rounded-lg"
    >
      <rect width={total} height={total} fill="#ffffff" />
      {cells.dark.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c + m} y={r + m} width={1} height={1} fill="#000000" />
      ))}
    </svg>
  );
}
