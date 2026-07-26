"use client";

import { useState, useTransition } from "react";
import { setChoreEffort, setChoreEffortLocked } from "@/lib/actions/chores";
import { EFFORT_VALUES, effortColor } from "@/lib/chores/effort";
import { LockIcon } from "@/components/icons";

/**
 * Shows the effort as a coloured 1-5 badge. Clicking opens a small picker
 * rather than changing anything, so a stray click can't alter the value; a
 * lock makes it read-only until deliberately unlocked.
 */
export function EffortControl({
  id,
  value,
  locked,
}: {
  id: string;
  value: number;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const pick = (v: number) => {
    if (locked) return;
    startTransition(() => void setChoreEffort(id, v));
    setOpen(false);
  };

  const toggleLock = () =>
    startTransition(() => void setChoreEffortLocked(id, !locked));

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`Effort ${value} of 5${locked ? " (locked)" : ""}`}
        aria-label={`Effort ${value} of 5`}
        className="relative inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold text-white"
        style={{ backgroundColor: effortColor(value) }}
      >
        {value}
        {locked && (
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink text-white">
            <LockIcon className="h-2.5 w-2.5" />
          </span>
        )}
      </button>

      {open && (
        <>
          <span
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <span className="absolute left-1/2 top-8 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-hairline bg-surface p-1 shadow-lg">
            {EFFORT_VALUES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => pick(v)}
                disabled={locked}
                aria-pressed={v === value}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-transform ${
                  v === value ? "text-white" : "text-white/70 hover:scale-110"
                } ${locked ? "opacity-40" : ""}`}
                style={{ backgroundColor: effortColor(v) }}
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={toggleLock}
              title={locked ? "Unlock effort" : "Lock effort"}
              className={`ml-1 flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                locked
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-hairline text-muted hover:border-accent hover:text-accent"
              }`}
            >
              <LockIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        </>
      )}
    </span>
  );
}
