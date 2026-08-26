"use client";

import { useRef, useState } from "react";

const SIZE = 248; // px, the editing circle

function parsePos(s: string): [number, number] {
  const m = s.match(/^(\d{1,3})% (\d{1,3})%$/);
  if (!m) return [50, 50];
  return [Number(m[1]), Number(m[2])];
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Drag the photo around inside a circle to choose what shows in the avatar.
 * Works purely in CSS object-position terms (0–100% each axis), so nothing is
 * re-cropped — the framing can be nudged again any time.
 */
export function AvatarAdjuster({
  src,
  color,
  position,
  onApply,
  onClose,
}: {
  src: string;
  color: string;
  position: string;
  onApply: (position: string) => void;
  onClose: () => void;
}) {
  const [[x, y], setXY] = useState<[number, number]>(() => parsePos(position));
  const last = useRef<{ px: number; py: number } | null>(null);

  const down = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    last.current = { px: e.clientX, py: e.clientY };
  };
  const move = (e: React.PointerEvent) => {
    if (!last.current) return;
    const dx = e.clientX - last.current.px;
    const dy = e.clientY - last.current.py;
    last.current = { px: e.clientX, py: e.clientY };
    // Dragging the image right reveals more of its left edge, i.e. a smaller
    // object-position X — so movement subtracts.
    setXY(([cx, cy]) => [
      clamp(cx - (dx / SIZE) * 100),
      clamp(cy - (dy / SIZE) * 100),
    ]);
  };
  const up = () => {
    last.current = null;
  };

  const posStr = `${Math.round(x)}% ${Math.round(y)}%`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-5 text-ink shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium">Position the photo</p>
        <p className="mt-1 text-xs text-muted">
          Drag the picture to choose what shows inside the circle.
        </p>

        <div className="mt-4 flex justify-center">
          <div
            className="relative touch-none select-none overflow-hidden rounded-full"
            style={{ width: SIZE, height: SIZE, boxShadow: `0 0 0 3px ${color}` }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="h-full w-full cursor-grab object-cover active:cursor-grabbing"
              style={{ objectPosition: posStr }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setXY([50, 50])}
            className="text-xs font-medium text-muted underline underline-offset-4 hover:text-ink"
          >
            Re-centre
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-full px-4 text-sm font-medium text-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(posStr);
                onClose();
              }}
              className="h-9 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
