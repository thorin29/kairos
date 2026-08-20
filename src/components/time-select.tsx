"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A clean time picker: a field that opens a scrollable list of half-hour slots
 * (12:00 AM … 11:30 PM) with the current time highlighted and scrolled into
 * view, matching the calendar's other controls. Typing filters the list and can
 * enter an off-grid time (7:45, 4:15 PM) that the presets don't offer, so a
 * copied event with an odd length still round-trips.
 *
 * Value is a 24-hour "HH:MM" string; it also writes a hidden input of that value
 * when given a `name`, so it drops straight into a plain form.
 */

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const mer = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${mer}`;
}

type Opt = { value: string; label: string };

const GRID: Opt[] = (() => {
  const out: Opt[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      out.push({ value: v, label: to12h(v) });
    }
  }
  return out;
})();

// Read free text as a concrete time when it's unambiguous. Forgiving about
// separators and am/pm; a bare hour with no meridiem is taken literally on a
// 24-hour clock (so "16" is 4 PM, "4" is 4 AM — type "4p" for the afternoon).
function parseTyped(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\./g, "");
  if (!s) return null;
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?\s*(a|am|p|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.[0];
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "p" && h !== 12) h += 12;
    if (mer === "a" && h === 12) h = 0;
  } else if (h > 23) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function TimeSelect({
  name,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  name?: string;
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const label = to12h(value);

  const options = useMemo<Opt[]>(() => {
    // The half-hour grid, plus the current value if it sits off-grid so it's
    // always visible and selectable.
    const base = GRID.some((o) => o.value === value)
      ? GRID
      : [{ value, label }, ...GRID].sort((a, b) =>
          a.value.localeCompare(b.value),
        );

    const q = text.trim();
    if (!q) return base;

    const norm = (x: string) => x.toLowerCase().replace(/[:\s]/g, "");
    const nq = norm(q);
    let list = base.filter((o) => norm(o.label).includes(nq));

    // Meridiem-aware and off-grid typing: "4p" → the 4 PM slots, "4:15" adds a
    // one-off 4:15 entry the grid doesn't carry.
    const parsed = parseTyped(q);
    if (parsed) {
      const ph = parsed.split(":")[0];
      const byHour = base.filter((o) => o.value.split(":")[0] === ph);
      const seen = new Set<string>();
      list = [...byHour, ...list].filter((o) =>
        seen.has(o.value) ? false : seen.add(o.value),
      );
      if (!list.some((o) => o.value === parsed)) {
        list = [{ value: parsed, label: to12h(parsed) }, ...list];
      }
    }
    return list.length ? list : base;
  }, [text, value, label]);

  // Close and revert when clicking away.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setText("");
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // On open: focus the filter, point the highlight at the current value, and
  // scroll it into view so the list opens centred on "now".
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    );
    setHighlight(idx);
    searchRef.current?.focus();
    requestAnimationFrame(() => {
      const el = listRef.current?.children[idx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "center" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlighted row visible as it moves.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setText("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = options[highlight]?.value ?? parseTyped(text);
      if (chosen) commit(chosen);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setText("");
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="tabular flex h-11 w-full items-center justify-between rounded-full border border-hairline bg-surface px-5 text-left outline-none focus:border-accent"
      >
        <span>{label}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {name && <input type="hidden" name={name} value={value} />}

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xl">
          <div className="p-2">
            <input
              ref={searchRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Type a time…"
              className="tabular h-9 w-full rounded-full border border-hairline bg-ground px-4 text-sm outline-none focus:border-accent"
            />
          </div>
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-64 overflow-y-auto pb-1"
          >
            {options.map((o, i) => {
              const isCurrent = o.value === value;
              const isActive = i === highlight;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isCurrent}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    commit(o.value);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`tabular cursor-pointer px-5 py-2.5 text-sm ${
                    isActive
                      ? "bg-accent text-white"
                      : isCurrent
                        ? "bg-accent/10 font-medium"
                        : "hover:bg-ground"
                  }`}
                >
                  {o.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
