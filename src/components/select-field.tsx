"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A dropdown styled to match the calendar's other controls — a rounded field and
 * a rounded option list — replacing native <select>, whose OS-drawn option list
 * can't be rounded. Writes a hidden input of `value` when given a `name`, so it
 * drops straight into a plain form.
 */
export function SelectField({
  name,
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Choose",
  className = "",
}: {
  name?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between rounded-full border border-hairline bg-surface px-5 text-left outline-none focus:border-accent"
      >
        <span className={current ? "" : "text-muted"}>
          {current ? current.label : placeholder}
        </span>
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

      {open && options.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xl">
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {options.map((o) => {
              const isCurrent = o.value === value;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isCurrent}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`cursor-pointer px-5 py-2.5 text-sm ${
                    isCurrent ? "bg-accent/10 font-medium" : "hover:bg-ground"
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
