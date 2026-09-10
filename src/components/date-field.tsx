"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";

/* Timezone-safe helpers: everything is done on YYYY-MM-DD strings and local
 * (y, m, d) integers, never Date parsing of an ISO string (which would treat it
 * as UTC and shift the day in negative offsets). */
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISO(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}
function parseISO(v: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function fmtUS(v: string): string {
  const p = parseISO(v);
  return p ? `${pad(p[1])}/${pad(p[2])}/${p[0]}` : "";
}
function todayISO(): string {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth() + 1, n.getDate());
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate(); // m is 1-based; day 0 of next month
}
function firstWeekday(y: number, m: number) {
  return new Date(y, m - 1, 1).getDay(); // 0 = Sunday
}
function ord(y: number, m: number, d: number) {
  return y * 10000 + m * 100 + d;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * A styled date picker that renders its own calendar popup instead of the
 * browser's native one, so it matches the app everywhere. Drop-in for
 * `<input type="date">`: pass `name` + `defaultValue` for an uncontrolled form
 * field, or `value` + `onChange` for a controlled one. `min` disables earlier
 * days. The visible trigger takes `className` (use the same field style you'd
 * give the input); the value submits as a hidden YYYY-MM-DD input.
 */
export function DateField({
  name,
  value,
  defaultValue,
  onChange,
  min,
  ariaLabel,
  className = "",
  wrapperClassName = "",
  placeholder = "mm/dd/yyyy",
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  min?: string;
  ariaLabel?: string;
  className?: string;
  wrapperClassName?: string;
  placeholder?: string;
}) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const val = controlled ? value ?? "" : internal;

  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const start = parseISO(val) ?? parseISO(todayISO())!;
  const [viewY, setViewY] = useState(start[0]);
  const [viewM, setViewM] = useState(start[1]); // 1-based

  // Re-center on the selected month each time the popup opens.
  useEffect(() => {
    if (!open) return;
    const p = parseISO(val) ?? parseISO(todayISO())!;
    setViewY(p[0]);
    setViewM(p[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = (v: string, close = true) => {
    if (!controlled) setInternal(v);
    onChange?.(v);
    if (close) setOpen(false);
  };

  const prevMonth = () =>
    setViewM((m) => {
      if (m === 1) {
        setViewY((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  const nextMonth = () =>
    setViewM((m) => {
      if (m === 12) {
        setViewY((y) => y + 1);
        return 1;
      }
      return m + 1;
    });

  const minP = min ? parseISO(min) : null;
  const isBefore = (y: number, m: number, d: number) =>
    minP ? ord(y, m, d) < ord(minP[0], minP[1], minP[2]) : false;

  const dim = daysInMonth(viewY, viewM);
  const lead = firstWeekday(viewY, viewM);
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];

  const selected = parseISO(val);
  const today = parseISO(todayISO())!;
  const monthLabel = new Date(viewY, viewM - 1, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div ref={boxRef} className={`relative ${wrapperClassName}`}>
      {name && <input type="hidden" name={name} value={val} readOnly />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={val ? "" : "text-muted"}>
          {val ? fmtUS(val) : placeholder}
        </span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-2xl border border-hairline bg-surface p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{monthLabel}</span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-xs font-medium text-muted">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {cells.map((c, i) =>
              c === null ? (
                <span key={i} />
              ) : (
                (() => {
                  const isSel =
                    selected &&
                    selected[0] === viewY &&
                    selected[1] === viewM &&
                    selected[2] === c;
                  const isToday =
                    today[0] === viewY && today[1] === viewM && today[2] === c;
                  const off = isBefore(viewY, viewM, c);
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={off}
                      onClick={() => commit(toISO(viewY, viewM, c))}
                      className={`flex h-8 items-center justify-center rounded-full text-sm transition-colors ${
                        isSel
                          ? "bg-accent font-semibold text-on-accent"
                          : off
                            ? "cursor-not-allowed text-muted/40"
                            : isToday
                              ? "font-semibold text-accent hover:bg-ground"
                              : "hover:bg-ground"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })()
              ),
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-sm font-medium">
            <button
              type="button"
              onClick={() => commit("")}
              className="text-muted transition-colors hover:text-ink"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const t = todayISO();
                const p = parseISO(t)!;
                if (!isBefore(p[0], p[1], p[2])) commit(t);
              }}
              className="text-accent transition-opacity hover:opacity-80"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
