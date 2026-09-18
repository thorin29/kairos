"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A styled free-text combobox: the user can type anything (submitted via the
 * named input), and a filtered, alphabetical dropdown of existing options shows
 * below — matching the app's own listbox styling rather than the browser's raw
 * <datalist>. Used for the class Subject picker and calendar event-name entry.
 * Typing a value that isn't in the list is allowed; the server find-or-creates.
 */
export function Combobox({
  name,
  options,
  defaultValue = "",
  placeholder,
  required,
  maxLength,
  fieldClassName,
}: {
  name: string;
  options: string[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  fieldClassName?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const sorted = Array.from(new Set(options)).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const q = value.trim().toLowerCase();
  const filtered = q ? sorted.filter((o) => o.toLowerCase().includes(q)) : sorted;

  return (
    <div ref={wrap} className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        className={fieldClassName}
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-hairline bg-surface py-1 shadow-lg"
        >
          {filtered.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={o === value}
                onClick={() => {
                  setValue(o);
                  setOpen(false);
                }}
                className={`block w-full px-4 py-2 text-left text-sm hover:bg-accent/10 ${
                  o === value ? "bg-accent/5 font-medium" : ""
                }`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
