"use client";

import { useEffect, type ReactNode } from "react";

/**
 * A centred pop-up of a fixed size (v0.803): it doesn't grow or shrink as
 * its content changes, so stepping through it doesn't make it jump. The body
 * scrolls; the footer stays put.
 */
export function Popup({
  title,
  onClose,
  onBack,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") (onBack ?? onClose)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onClose]);
  return (
    <div className="animate-backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-[min(34rem,90dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-3">
          {onBack && (
            <button type="button" aria-label="Back" onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full text-lg hover:bg-ground">
              &lsaquo;
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink">
            &#10005;
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-hairline px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
