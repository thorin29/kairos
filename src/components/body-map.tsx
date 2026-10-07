"use client";

import { useMemo, useState } from "react";
import {
  BACK_OUTLINES,
  BACK_PATHS,
  BACK_VIEWBOX,
  FRONT_OUTLINES,
  FRONT_PATHS,
  FRONT_VIEWBOX,
  type BodyPath,
} from "@/components/body-map-paths";
import { NAV_LABEL, type NavRegion } from "@/lib/workouts/involvement";

export type { NavRegion };

/**
 * The clickable body. Two figures, one tap target per region.
 *
 * Two separate ideas live here and they are deliberately not the same field:
 *
 *   SELECTION  — `nav`. Which target a click resolves to. One per region.
 *   SHADING    — `group`. Which muscle group the region lights up as.
 *
 * A deadlift is why. Tapping the lower back or the glutes selects it, but
 * those pixels shade as Core (obliques, lumbar erectors) and Legs (glutes) —
 * the lower back being part of the core, not a thing apart from it.
 *
 * Colours are decided by the CALLER and handed over in `fills`, so the body and
 * the muscle-group headings above the charts cannot drift apart.
 */

/** Which figure a view shows. A deadlift is posterior-only; a squat is both. */
export type BodyView = "front" | "back" | "both";

type Props = {
  /** Tap targets currently selected. Several at once on a multi-group day. */
  selected?: NavRegion[];
  onSelect?: (nav: NavRegion) => void;
  /**
   * Muscle group -> the colour to paint it. A group absent from this map is
   * drawn inert. The caller owns the palette.
   */
  fills?: Record<string, string>;
  /** Which figures to draw. "both" is the default and right for most. */
  view?: BodyView;
  /** Tap targets with nothing behind them are drawn inert and not clickable. */
  available?: NavRegion[];
  className?: string;
};

const INERT = "var(--color-hairline)";

function Figure({
  paths,
  outlines,
  box,
  selected,
  focused,
  setFocused,
  onSelect,
  fills,
  available,
  label,
}: {
  paths: BodyPath[];
  outlines: Record<string, string>;
  box: { w: number; h: number };
  selected: Set<NavRegion>;
  focused: NavRegion | null;
  setFocused: (n: NavRegion | null) => void;
  onSelect?: (nav: NavRegion) => void;
  fills: Record<string, string>;
  available: Set<NavRegion> | null;
  label: string;
}) {
  // One tab stop per TARGET, not per path. Legs alone is thirteen regions;
  // making each focusable would put seventy stops between the keyboard and the
  // rest of the page.
  const seen = new Set<NavRegion>();
  return (
    <svg
      viewBox={`0 0 ${box.w} ${box.h}`}
      className="h-auto w-full max-w-[190px]"
      role="group"
      aria-label={label}
    >
      {paths.map((p, i) => {
        const nav = p.nav as NavRegion | null;
        const inert = !p.group || !nav;
        const live = !inert && (!available || available.has(nav!));
        const firstOfTarget = live && !seen.has(nav!);
        if (firstOfTarget) seen.add(nav!);

        // Shading is by GROUP; selection is by NAV.
        const fill = inert ? INERT : (fills[p.group!] ?? INERT);

        return (
          <path
            key={i}
            d={p.d}
            fill={fill}
            // Explicit, not a utility class: a focused <path> otherwise draws
            // the browser's default ring around its BOUNDING BOX, which shows
            // up as a stray rectangle across the thigh.
            style={{ outline: "none" }}
            className={live ? "cursor-pointer transition-[fill]" : undefined}
            onClick={live ? () => onSelect?.(nav!) : undefined}
            onFocus={firstOfTarget ? () => setFocused(nav!) : undefined}
            onBlur={firstOfTarget ? () => setFocused(null) : undefined}
            onKeyDown={
              firstOfTarget
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(nav!);
                    }
                  }
                : undefined
            }
            tabIndex={firstOfTarget ? 0 : -1}
            role={firstOfTarget ? "button" : undefined}
            aria-label={firstOfTarget ? NAV_LABEL[nav!] : undefined}
          />
        );
      })}

      {/* One ring per selected target, traced from the UNION of its regions.
          Stroking each path instead rings every internal muscle seam. */}
      {[...selected].map((nav) =>
        outlines[nav] ? (
          <path
            key={`sel-${nav}`}
            d={outlines[nav]}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={4}
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ) : null,
      )}

      {/* Keyboard focus, drawn the way selection is so it reads as the same
          idea rather than as a rectangle from nowhere. */}
      {focused && outlines[focused] && !selected.has(focused) && (
        <path
          d={outlines[focused]}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={4}
          strokeDasharray="10 7"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

export default function BodyMap({
  selected = [],
  onSelect,
  fills = {},
  view = "both",
  available,
  className,
}: Props) {
  const [focused, setFocused] = useState<NavRegion | null>(null);
  const sel = useMemo(() => new Set(selected), [selected]);
  const avail = useMemo(
    () => (available ? new Set(available) : null),
    [available],
  );

  const showFront = view === "front" || view === "both";
  const showBack = view === "back" || view === "both";

  const shared = {
    selected: sel,
    focused,
    setFocused,
    onSelect,
    fills,
    available: avail,
  };

  return (
    <div className={`flex items-start justify-center gap-3 ${className ?? ""}`}>
      {showFront && (
        <Figure
          {...shared}
          paths={FRONT_PATHS}
          outlines={FRONT_OUTLINES}
          box={FRONT_VIEWBOX}
          label="Front of the body"
        />
      )}
      {showBack && (
        <Figure
          {...shared}
          paths={BACK_PATHS}
          outlines={BACK_OUTLINES}
          box={BACK_VIEWBOX}
          label="Back of the body"
        />
      )}
    </div>
  );
}
