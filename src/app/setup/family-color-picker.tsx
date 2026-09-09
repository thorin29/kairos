"use client";

import { useState, useTransition } from "react";
import { setFamilyColor } from "@/lib/actions/people";
import { FAMILY_PALETTE } from "@/lib/palette";

/**
 * Picks the shared family calendar color. Choosing a swatch stages it and asks
 * for confirmation before saving — Cancel reverts to the last saved color, so a
 * mis-tap never changes what the whole household sees.
 */
export function FamilyColorPicker({ current }: { current: string }) {
  const [saved, setSaved] = useState(current);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const active = pending ?? saved;

  const propose = (c: string) => {
    if (c && c !== saved) setPending(c);
  };
  const confirm = () => {
    if (!pending) return;
    const c = pending;
    setSaved(c);
    setPending(null);
    start(() => {
      void setFamilyColor(c);
    });
  };
  const cancel = () => setPending(null);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        {FAMILY_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => propose(c)}
            disabled={busy}
            aria-label={`Family color ${c}`}
            aria-pressed={active === c}
            className={`h-9 w-9 rounded-full transition-transform disabled:opacity-60 ${
              active === c
                ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-ground"
                : "hover:scale-105"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <label className="ml-1 inline-flex items-center gap-2 text-xs text-muted">
          <input
            type="color"
            value={active}
            onChange={(e) => propose(e.target.value)}
            disabled={busy}
            aria-label="Custom family color"
            className="h-9 w-11 cursor-pointer rounded-lg border border-hairline bg-surface p-1"
          />
          custom
        </label>
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Change the family color?</h3>
            <p className="mt-1 text-sm text-muted">
              This is the shared color for family events, birthdays, and
              holidays across everyone&rsquo;s calendar.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span
                className="h-10 w-10 rounded-full ring-2 ring-ink ring-offset-2 ring-offset-surface"
                style={{ backgroundColor: pending }}
                aria-hidden
              />
              <span className="text-sm text-muted">{pending}</span>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancel}
                className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent shadow-sm hover:shadow-md disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
