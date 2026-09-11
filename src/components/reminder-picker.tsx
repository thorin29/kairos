"use client";

import { useState } from "react";

const PRESETS = [10, 15, 30, 60];

/** Readable lead-time label, e.g. 60 -> "1 hr", 2880 -> "2 days". */
export function reminderLabel(min: number): string {
  if (min % 10080 === 0) {
    const n = min / 10080;
    return `${n} wk${n > 1 ? "s" : ""}`;
  }
  if (min % 1440 === 0) {
    const n = min / 1440;
    return `${n} day${n > 1 ? "s" : ""}`;
  }
  if (min % 60 === 0) return `${min / 60} hr`;
  return `${min} min`;
}

/**
 * Reminder lead-time picker: fixed presets (10/15/30 min, 1 hr) plus a "Custom…"
 * entry (amount + unit) in place of a "1 day" button, to save space while still
 * allowing any lead time. Selected custom values show as removable chips.
 */
export function ReminderPicker({
  reminders,
  onToggle,
}: {
  reminders: Set<number>;
  onToggle: (min: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState(1440);
  const customMins = [...reminders]
    .filter((m) => !PRESETS.includes(m))
    .sort((a, b) => a - b);

  const btn = (selected: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      selected
        ? "border-accent bg-accent/10 text-accent"
        : "border-hairline text-muted hover:border-accent"
    }`;

  const addCustom = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    const min = Math.round(n * unit);
    if (min > 0 && !reminders.has(min)) onToggle(min);
    setAmount("");
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onToggle(m)}
          aria-pressed={reminders.has(m)}
          className={btn(reminders.has(m))}
        >
          {reminderLabel(m)}
        </button>
      ))}
      {customMins.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onToggle(m)}
          aria-pressed
          title="Remove"
          className={btn(true)}
        >
          {reminderLabel(m)} ✕
        </button>
      ))}
      {open ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
              if (e.key === "Escape") setOpen(false);
            }}
            className="h-9 w-16 rounded-full border border-accent px-3 text-sm outline-none"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(Number(e.target.value))}
            className="h-9 rounded-full border border-hairline bg-surface px-3 text-sm select-caret"
          >
            <option value={1}>min</option>
            <option value={60}>hr</option>
            <option value={1440}>days</option>
            <option value={10080}>wks</option>
          </select>
          <button
            type="button"
            onClick={addCustom}
            className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-on-accent"
          >
            Add
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={btn(false)}>
          Custom…
        </button>
      )}
    </div>
  );
}
