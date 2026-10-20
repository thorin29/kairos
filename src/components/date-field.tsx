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
const MONTHS_SHORT = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleString("default", { month: "short" }),
);

/** Digits typed into a date box, shaped as mm/dd/yyyy while you type. */
function maskTyped(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** A complete mm/dd/yyyy that is a real date, as YYYY-MM-DD; otherwise null. */
function readTyped(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return toISO(y, mo, d);
}

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
  max,
  ariaLabel,
  className = "",
  wrapperClassName = "",
  placeholder = "mm/dd/yyyy",
  disabled = false,
  typeable = false,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  min?: string;
  max?: string;
  ariaLabel?: string;
  className?: string;
  wrapperClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Type the date as well as pick it — for dates far from today, like a
   *  birthday, where paging month by month is slow. */
  typeable?: boolean;
}) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const val = controlled ? value ?? "" : internal;

  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const start = parseISO(val) ?? parseISO(todayISO())!;
  const [viewY, setViewY] = useState(start[0]);
  const [viewM, setViewM] = useState(start[1]); // 1-based
  // Which grid the popup shows: days, or a quick pick of month or year (tap the
  // month or the year in the header).
  const [mode, setMode] = useState<"days" | "months" | "years">("days");
  const yearListRef = useRef<HTMLDivElement>(null);

  // What is typed, when typing is allowed. Follows the value whenever it
  // changes from outside (a pick from the calendar, a reset).
  const [text, setText] = useState(fmtUS(val));
  const [typedBad, setTypedBad] = useState(false);
  useEffect(() => {
    setText(fmtUS(val));
    setTypedBad(false);
  }, [val]);

  // Re-center on the selected month each time the popup opens.
  useEffect(() => {
    if (!open) return;
    const p = parseISO(val) ?? parseISO(todayISO())!;
    setViewY(p[0]);
    setViewM(p[1]);
    setMode("days");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Opening the year list puts the year being shown in the middle of it.
  useEffect(() => {
    if (mode !== "years") return;
    const el = yearListRef.current?.querySelector<HTMLElement>("[data-current='1']");
    el?.scrollIntoView({ block: "center" });
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    // Capture-phase pointerdown: fires before any element (including buttons
    // that stopPropagation) can swallow the event, so a click ANYWHERE outside
    // the calendar closes it — on mouse and touch alike.
    const onDoc = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc, true);
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

  const today0 = parseISO(todayISO())!;
  const minP = min ? parseISO(min) : null;
  const maxP = max ? parseISO(max) : null;
  const isBefore = (y: number, m: number, d: number) =>
    minP ? ord(y, m, d) < ord(minP[0], minP[1], minP[2]) : false;
  const isAfter = (y: number, m: number, d: number) =>
    maxP ? ord(y, m, d) > ord(maxP[0], maxP[1], maxP[2]) : false;
  const outOfRange = (y: number, m: number, d: number) =>
    isBefore(y, m, d) || isAfter(y, m, d);

  const firstYear = minP ? minP[0] : 1900;
  const lastYear = maxP ? maxP[0] : today0[0] + 20;
  const years = Array.from(
    { length: Math.max(0, lastYear - firstYear + 1) },
    (_, i) => firstYear + i,
  );

  const dim = daysInMonth(viewY, viewM);
  const lead = firstWeekday(viewY, viewM);
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];

  const selected = parseISO(val);
  const today = parseISO(todayISO())!;
  const monthName = new Date(viewY, viewM - 1, 1).toLocaleString("default", {
    month: "long",
  });

  /** A typed date: shaped as you type, saved once it's a whole real date in
   *  range. Anything else is left for you to finish, and put back on leaving. */
  const onType = (raw: string) => {
    const next = maskTyped(raw);
    setText(next);
    if (next === "") {
      setTypedBad(false);
      commit("", false);
      return;
    }
    const iso = readTyped(next);
    if (iso) {
      const p = parseISO(iso)!;
      if (outOfRange(p[0], p[1], p[2])) {
        setTypedBad(true);
        return;
      }
      setTypedBad(false);
      commit(iso, false);
      setViewY(p[0]);
      setViewM(p[1]);
    } else {
      setTypedBad(next.length === 10);
    }
  };
  const onTypeBlur = () => {
    if (text !== fmtUS(val)) {
      setText(fmtUS(val));
      setTypedBad(false);
    }
  };

  const headBtn =
    "rounded-full px-2 py-1 text-sm font-semibold transition-colors hover:bg-ground";

  return (
    <div ref={boxRef} className={`relative ${wrapperClassName}`}>
      {name && <input type="hidden" name={name} value={val} readOnly />}
      {typeable ? (
        <div
          className={`flex items-center justify-between gap-2 ${
            typedBad ? "border-red-600!" : ""
          } ${disabled ? "opacity-40" : ""} ${className}`}
        >
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={text}
            onChange={(e) => onType(e.target.value)}
            onBlur={onTypeBlur}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={ariaLabel}
            aria-invalid={typedBad}
            className="tabular w-full min-w-0 bg-transparent outline-none placeholder:text-muted"
          />
          <button
            type="button"
            onClick={() => !disabled && setOpen((o) => !o)}
            disabled={disabled}
            aria-label="Pick from a calendar"
            aria-haspopup="dialog"
            aria-expanded={open}
            className="-mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`flex items-center justify-between gap-2 text-left disabled:opacity-40 ${className}`}
        >
          <span className={val ? "" : "text-muted"}>
            {val ? fmtUS(val) : placeholder}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted" />
        </button>
      )}
      {typeable && typedBad && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          Not a date that can be used — check the month, day and year.
        </p>
      )}

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-2xl border border-hairline bg-surface p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className={`flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink ${mode === "days" ? "" : "invisible"}`}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setMode((m) => (m === "months" ? "days" : "months"))}
                aria-label="Choose month"
                aria-pressed={mode === "months"}
                className={`${headBtn} ${mode === "months" ? "bg-ground text-accent" : ""}`}
              >
                {monthName}
              </button>
              <button
                type="button"
                onClick={() => setMode((m) => (m === "years" ? "days" : "years"))}
                aria-label="Choose year"
                aria-pressed={mode === "years"}
                className={`${headBtn} tabular ${mode === "years" ? "bg-ground text-accent" : ""}`}
              >
                {viewY}
              </button>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className={`flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink ${mode === "days" ? "" : "invisible"}`}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          {mode === "months" && (
            <div className="mt-2 grid grid-cols-3 gap-1">
              {MONTHS_SHORT.map((label, i) => {
                const on = i + 1 === viewM;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setViewM(i + 1);
                      setMode("days");
                    }}
                    className={`h-10 rounded-full text-sm transition-colors ${
                      on ? "bg-accent font-semibold text-on-accent" : "hover:bg-ground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {mode === "years" && (
            <div ref={yearListRef} className="mt-2 grid max-h-56 grid-cols-4 gap-1 overflow-y-auto pr-1">
              {years.map((y) => {
                const on = y === viewY;
                return (
                  <button
                    key={y}
                    type="button"
                    data-current={on ? "1" : undefined}
                    onClick={() => {
                      setViewY(y);
                      setMode("months");
                    }}
                    className={`tabular h-9 rounded-full text-sm transition-colors ${
                      on ? "bg-accent font-semibold text-on-accent" : "hover:bg-ground"
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          {mode === "days" && (<>
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
                  const off = outOfRange(viewY, viewM, c);
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

          </>)}

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
                if (!outOfRange(p[0], p[1], p[2])) commit(t);
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
