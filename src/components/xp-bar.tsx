"use client";

import type { GrowthRow } from "@/lib/scoring/growth-cells";

/**
 * The character's row of squares: how far it has grown toward adult, coloured
 * by what earned it, with today's squares lighter (today can still change).
 * The squares themselves come from `growthRow` (src/lib/scoring/growth-cells.ts),
 * the same rule the phone is sent.
 */
export function XpBar({ row }: { row: GrowthRow }) {
  const gaps = new Set(row.gaps);
  const filled = row.cells.filter(Boolean).length;
  return (
    <div className="flex gap-[2px]" role="img" aria-label={row.label ?? `${filled} of ${row.cells.length}`}>
      {row.cells.map((c, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-[2px]"
          style={{
            background: c || "var(--color-hairline)",
            opacity: !c ? 0.5 : i >= row.pendingFrom ? 0.45 : 1,
            // The divider is margin on the cell before it, not an extra
            // element: an element would need its own width in the flex row and
            // would shift the cells out of a clean grid.
            marginRight: gaps.has(i + 1) ? 7 : undefined,
          }}
        />
      ))}
    </div>
  );
}
