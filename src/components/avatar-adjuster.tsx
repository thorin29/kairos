"use client";

import { useRef, useState } from "react";
import { parseAvatarTransform, avatarTransformCss } from "@/lib/avatars";

const SIZE = 248; // px, the editing circle
const PAN_LIMIT = 150; // % — how far the picture can be pushed each way
const clampPan = (n: number) => Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, n));
const clampZoom = (n: number) => Math.max(0.3, Math.min(3, n));

/**
 * Drag the photo to move it and use the slider to zoom. It's a free transform,
 * so a transparent PNG (or any photo) can be moved a long way and scaled up or
 * down — not just nudged. Stored as "<tx> <ty> <scale>".
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
  const start = parseAvatarTransform(position);
  const [tx, setTx] = useState(start.tx);
  const [ty, setTy] = useState(start.ty);
  const [scale, setScale] = useState(start.scale);
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
    // Direct manipulation: the picture follows the cursor.
    setTx((v) => clampPan(v + (dx / SIZE) * 100));
    setTy((v) => clampPan(v + (dy / SIZE) * 100));
  };
  const up = () => {
    last.current = null;
  };

  const value = `${Math.round(tx)} ${Math.round(ty)} ${scale}`;

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
          Drag to move it, and use the slider to zoom.
        </p>

        <div className="mt-4 flex justify-center">
          <div
            className="relative touch-none select-none overflow-hidden rounded-full"
            style={{
              width: SIZE,
              height: SIZE,
              boxShadow: `0 0 0 3px ${color}`,
              backgroundColor: `${color}1a`,
            }}
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
              style={{ transform: avatarTransformCss({ tx, ty, scale }) }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs font-medium text-muted">Zoom</span>
          <input
            type="range"
            min={0.3}
            max={3}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(clampZoom(Number(e.target.value)))}
            className="h-1.5 flex-1 cursor-pointer accent-accent"
          />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setTx(0);
              setTy(0);
              setScale(1);
            }}
            className="text-xs font-medium text-muted underline underline-offset-4 hover:text-ink"
          >
            Reset
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
                onApply(value);
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
