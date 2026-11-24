"use client";

import { useState, useTransition } from "react";
import { setPlacesZoneColorAction } from "@/lib/actions/places";
import { ZONE_PALETTE } from "@/lib/places/zone-colors";

export type ZoneView = { name: string; color: string; picked: boolean; icon: string | null };

const card = "space-y-3 rounded-xl border border-hairline bg-surface px-4 py-4";
const label = "text-xs font-semibold uppercase tracking-widest text-muted";

/**
 * Zone colours (v0.779): each Home Assistant zone's colour on the Family map
 * cards; the icon is the one Home Assistant sends.
 */
export function ZoneColors({ zones }: { zones: ZoneView[] }) {
  const [colors, setColors] = useState(() => Object.fromEntries(zones.map((z) => [z.name, z.color])));
  const [pending, start] = useTransition();
  if (zones.length === 0) return null;
  const pick = (name: string, color: string) => {
    setColors((c) => ({ ...c, [name]: color }));
    start(async () => {
      await setPlacesZoneColorAction(name, color);
    });
  };
  return (
    <section className={card}>
      <h2 className={label}>Zone colors</h2>
      <ul className="divide-y divide-hairline">
        {zones.map((z) => (
          <li key={z.name} className="flex items-center gap-3 py-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: colors[z.name] }}
            >
              {z.icon && (
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="#fff" aria-hidden>
                  <path d={z.icon} />
                </svg>
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{z.name}</span>
            <span className="flex flex-wrap justify-end gap-1.5">
              {ZONE_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={pending}
                  onClick={() => pick(z.name, c)}
                  aria-label={`${z.name}: ${c}`}
                  aria-pressed={colors[z.name] === c}
                  className={`h-6 w-6 rounded-full border border-hairline ${
                    colors[z.name] === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
