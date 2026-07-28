"use client";

import { useEffect } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Digits entered on screen or from a real keyboard. Controlled, so the parent
 * owns the value and decides what "submit" means (Enter calls onSubmit). Keeps
 * a touch tablet usable without the OS keyboard, while a physical keyboard —
 * digits, Backspace, Enter — still works.
 */
export function PinEntry({
  value,
  onChange,
  onSubmit,
  max = 8,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  max?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        onChange((value + e.key).slice(0, max));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        onChange(value.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSubmit?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange, onSubmit, max]);

  const press = (d: string) => onChange((value + d).slice(0, max));

  const key =
    "flex h-12 items-center justify-center rounded-xl border border-hairline bg-surface font-display text-xl font-medium transition-colors hover:border-accent hover:text-accent active:bg-accent/10";

  return (
    <div className="mx-auto max-w-[15rem]">
      <div
        className="mb-3 flex h-11 items-center justify-center gap-2.5 rounded-xl border border-hairline bg-surface"
        aria-live="polite"
        aria-label={`${value.length} digits entered`}
      >
        {value.length === 0 ? (
          <span className="text-sm text-muted">Enter PIN</span>
        ) : (
          Array.from({ length: value.length }, (_, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden />
          ))
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={key}>
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange("")}
          className={`${key} text-xs text-muted`}
        >
          Clear
        </button>
        <button type="button" onClick={() => press("0")} className={key}>
          0
        </button>
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          aria-label="Delete last digit"
          className={`${key} text-sm text-muted`}
        >
          &larr;
        </button>
      </div>
    </div>
  );
}
