import type { ComponentType } from "react";
import { GrassIcon, WaterIcon } from "@/components/icons";

export type ChoreIconEntry = {
  label: string;
  Icon: ComponentType<{ className?: string }>;
  /** Tailwind text-color class the badge is tinted with. */
  colorClass: string;
};

/** The glyphs a chore can carry, keyed by the value stored in Chore.icon.
 *  Add an entry here (and the icon in icons.tsx) to offer a new badge. */
export const CHORE_ICONS: Record<string, ChoreIconEntry> = {
  grass: { label: "Grass", Icon: GrassIcon, colorClass: "text-green-600" },
  water: { label: "Water", Icon: WaterIcon, colorClass: "text-blue-600" },
};

export const CHORE_ICON_KEYS = Object.keys(CHORE_ICONS);

export type ChoreBadge = { icon: string; count: number };

/** Inline badges rendered after the Chores summary line: one tinted glyph per
 *  distinct icon completed today, with \u00d7N when it was done more than once
 *  (always-open chores). Unknown icon keys are skipped. */
export function ChoreBadges({
  badges,
  className,
}: {
  badges: ChoreBadge[];
  className?: string;
}) {
  const shown = badges.filter((b) => CHORE_ICONS[b.icon]);
  if (shown.length === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {shown.map((b) => {
        const entry = CHORE_ICONS[b.icon];
        const Icon = entry.Icon;
        return (
          <span
            key={b.icon}
            className={`inline-flex items-center ${entry.colorClass}`}
            title={entry.label}
          >
            <Icon className="h-4 w-4" />
            {b.count > 1 && (
              <span className="tabular ml-0.5 text-xs font-semibold">
                &times;{b.count}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
