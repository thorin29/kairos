"use client";

/**
 * A small segmented control: both options are always visible, the active one
 * filled, so it reads as "these are the choices, this is the current one"
 * instead of a pill that silently flips.
 */
export function Segmented({
  options,
  value,
  onSelect,
  disabledValues = [],
  busy = false,
}: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  disabledValues?: string[];
  busy?: boolean;
}) {
  return (
    <span className="inline-flex rounded-full border border-hairline p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        const disabled = busy || disabledValues.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled && !active}
            aria-pressed={active}
            onClick={() => {
              if (!active) onSelect(o.value);
            }}
            className={`h-7 rounded-full px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              active ? "bg-accent text-white" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}
