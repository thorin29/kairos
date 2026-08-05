"use client";

import { useEffect, useRef } from "react";

export type MenuItem = {
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Small tag shown on the right (e.g. "soon" for a not-yet-built action). */
  hint?: string;
};

const ITEM_H = 42;
const MENU_W = 180;

/**
 * A small action popover for a calendar event, opened by right-click (desktop)
 * or long-press (tablet). Positioned at the pointer and clamped on-screen.
 *
 * A long-press releases into a click; that click would otherwise land on the
 * backdrop and close the menu the instant it appeared, so backdrop dismissal
 * ignores anything within a short window of opening.
 */
export function EventMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const openedAt = useRef(Date.now());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
  const vh = typeof window !== "undefined" ? window.innerHeight : 9999;
  const left = Math.max(8, Math.min(x, vw - MENU_W - 8));
  const top = Math.max(8, Math.min(y, vh - (items.length * ITEM_H + 8) - 8));

  const dismiss = () => {
    if (Date.now() - openedAt.current < 400) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] select-none"
      onClick={dismiss}
      onContextMenu={(e) => {
        e.preventDefault();
        dismiss();
      }}
    >
      <div
        role="menu"
        onClick={(e) => e.stopPropagation()}
        style={{ left, top, width: MENU_W }}
        className="absolute overflow-hidden rounded-xl border border-hairline bg-surface py-1 shadow-xl"
      >
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              if (it.disabled) return;
              it.onSelect?.();
              onClose();
            }}
            className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
              it.disabled
                ? "cursor-default text-muted/50"
                : it.danger
                  ? "text-red-700 hover:bg-red-50"
                  : "hover:bg-ground"
            }`}
          >
            <span>{it.label}</span>
            {it.hint && (
              <span className="rounded-full bg-shade px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-muted">
                {it.hint}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
