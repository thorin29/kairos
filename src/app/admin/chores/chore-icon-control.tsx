"use client";

import { useState, useTransition } from "react";
import { setChoreIcon } from "@/lib/actions/chores";
import { CHORE_ICONS, CHORE_ICON_KEYS } from "@/lib/chore-icons";

/** A small picker for a chore's badge glyph — the icon shown after the Chores
 *  summary line when the chore is done today. Click to open a menu of None +
 *  each available glyph. */
export function ChoreIconControl({
  id,
  value,
}: {
  id: string;
  value: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const pick = (icon: string | null) => {
    startTransition(() => void setChoreIcon(id, icon));
    setOpen(false);
  };

  const current = value ? CHORE_ICONS[value] : null;
  const CurrentIcon = current?.Icon;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={current ? `Badge: ${current.label}` : "No badge"}
        aria-label="Chore badge"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-hairline bg-surface text-muted hover:border-accent"
      >
        {current && CurrentIcon ? (
          <span className={current.colorClass}>
            <CurrentIcon className="h-4 w-4" />
          </span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-hairline" aria-hidden />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-10 flex items-center gap-1 rounded-full border border-hairline bg-surface p-1 shadow-sm">
          <button
            type="button"
            onClick={() => pick(null)}
            title="No badge"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-ground ${
              !value ? "ring-1 ring-accent" : ""
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-hairline" aria-hidden />
          </button>
          {CHORE_ICON_KEYS.map((key) => {
            const entry = CHORE_ICONS[key];
            const Icon = entry.Icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => pick(key)}
                title={entry.label}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-ground ${
                  value === key ? "ring-1 ring-accent" : ""
                }`}
              >
                <span className={entry.colorClass}>
                  <Icon className="h-4 w-4" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
